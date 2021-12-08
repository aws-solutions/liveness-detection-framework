#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name solution-name version-code [--no-suffix]
#
# Parameters:
#  - source-bucket-base-name: Name for the S3 bucket location. If the --no-suffix flag is not present, the template will
#    append '-reference' and '-[region_name]' suffixes to this bucket name.
#
#  - solution-name: name of the solution for consistency
#
#  - version-code: version of the package

[ "$DEBUG" == 'true' ] && set -x
set -e

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# This is set by initialize-repo.sh
SOLUTION_ID="SO0175"

# Get reference for all important folders
template_dir="$PWD"
template_tmp_dir="$template_dir/tmp"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

######################################################
# Step 1/5: Clean
######################################################
rm -rf $template_tmp_dir
mkdir -p $template_tmp_dir
rm -rf $template_dist_dir
mkdir -p $template_dist_dir
rm -rf $build_dist_dir
mkdir -p $build_dist_dir
rm -rf $source_dir/backend/packaged
rm -rf $source_dir/backend/.chalice/deployments
rm -rf $source_dir/client/node_modules
rm -rf $source_dir/client/build
rm -rf $source_dir/client/public/weights
mkdir -p $source_dir/client/public/weights

######################################################
# Step 2/5: Build backend (Chalice)
######################################################
cd $source_dir/backend || exit
# Copy the cognito CFN template to the dist dir
cp cognito.yaml $template_dist_dir/cognito.template
# Build
python -m venv /tmp/venv
. /tmp/venv/bin/activate
pip install -r requirements.txt
chalice package --merge-template resources.yaml $template_tmp_dir
deactivate
cd $template_tmp_dir || exit
# Copy the Lambda function to the dist dir
cp deployment.zip $build_dist_dir/deployment.zip
# Append description
echo 'Description: Liveness Detection Framework %%VERSION%% - Backend template' >> sam.yaml
# Copy the backend CFN template to the dist dir
cp sam.yaml $template_dist_dir/backend.template

######################################################
# Step 3/5: Build client (React)
######################################################
cd $source_dir/client || exit
npm ci
# Download ML models
curl -o public/weights/tiny_face_detector_model-shard1.shard -kL https://github.com/justadudewhohacks/face-api.js/blob/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/tiny_face_detector_model-shard1?raw=true
echo 'f3020debaf078347b5caaff4bf6dce2f379d20bc *public/weights/tiny_face_detector_model-shard1.shard' | shasum -c
curl -o public/weights/tiny_face_detector_model-weights_manifest.json -kL https://github.com/justadudewhohacks/face-api.js/blob/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/tiny_face_detector_model-weights_manifest.json?raw=true
echo '1f9da0ddb847fcd512cb0511f6d6c90985d011e6 *public/weights/tiny_face_detector_model-weights_manifest.json' | shasum -c
curl -o public/weights/face_landmark_68_model-shard1.shard -kL https://github.com/justadudewhohacks/face-api.js/blob/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/face_landmark_68_model-shard1?raw=true
echo 'e8b453a3ce2a66e6fa070d4e30cd4e91c911964b *public/weights/face_landmark_68_model-shard1.shard' | shasum -c
curl -o public/weights/face_landmark_68_model-weights_manifest.json -kL https://github.com/justadudewhohacks/face-api.js/blob/a86f011d72124e5fb93e59d5c4ab98f699dd5c9c/weights/face_landmark_68_model-weights_manifest.json?raw=true
echo 'a981c7adfc6366e7b51b6c83b3bb84961a9a4b15 *public/weights/face_landmark_68_model-weights_manifest.json' | shasum -c

# Replace model references
perl -i -pe 's/tiny_face_detector_model-shard1/tiny_face_detector_model-shard1.shard/g' public/weights/tiny_face_detector_model-weights_manifest.json
perl -i -pe 's/face_landmark_68_model-shard1/face_landmark_68_model-shard1.shard/g' public/weights/face_landmark_68_model-weights_manifest.json
# Build
npm run build
# Zip web client assets into a single file
cd build || exit
zip -r client-build.zip .
# Copy web client assets to the dist dir
cp client-build.zip $build_dist_dir/
# Copy the template to the dist dir
cd ..
cp template-one-click.yaml $template_dist_dir/client.template

######################################################
# Step 4/5: Copy and rename templates
######################################################
cp $template_dir/*.yaml $template_dist_dir/
cd $template_dist_dir || exit
# Rename all *.yaml to *.template
for f in *.yaml; do 
    mv -- "$f" "${f%.yaml}.template"
done
cd ..

######################################################
# Step 5/5: Replacements in templates
######################################################
# Bucket suffixes
if [[ -z "$4" ]]; then suffix_ref=', "reference"'; else suffix_ref=''; fi
if [[ -z "$4" ]]; then suffix_region=',  !Ref AWS::Region'; else suffix_region=''; fi

declare -a replacements=( \
    "s/%%SUFFIX_REF%%/$suffix_ref/g" \
    "s/%%SUFFIX_REGION%%/$suffix_region/g" \
    "s/%%SOLUTION_ID%%/$SOLUTION_ID/g" \
    "s/%%BUCKET_NAME%%/$1/g" \
    "s/%%SOLUTION_NAME%%/$2/g" \
    "s/%%VERSION%%/$3/g" \
    "s/%%CLIENT_BUILD_KEY%%/client-build.zip/g" \
    "s/\.\/deployment\.zip/{Bucket: !Ref LambdaCodeUriBucket, Key: !Ref LambdaCodeUriKey}/g" \
    "s/'%%REF_COGNITO_USER_POOL_ARN%%'/!Ref CognitoUserPoolArn/g" \
    "s/- LivenessUserPool:.*$/- LivenessUserPool: \[\]/g" \
)
for replacement in "${replacements[@]}"
do
   if [[ "$OSTYPE" == "darwin"* ]]; then
     sed -i '' -e "$replacement" "$template_dist_dir"/*.template
   else
     sed -i -e "$replacement" "$template_dist_dir"/*.template
   fi
done
