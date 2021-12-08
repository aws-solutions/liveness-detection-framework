# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import base64
import binascii
import imghdr
import decimal
import functools
import json
import os
import secrets
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from botocore import config
from botocore.exceptions import ClientError
from chalice import Blueprint, CognitoUserPoolAuthorizer, BadRequestError, NotFoundError, UnauthorizedError

from .jwt_manager import JwtManager

blueprint = Blueprint(__name__)

STATE_NEXT = 1
STATE_CONTINUE = 0
CHALLENGE_FAIL = -1
CHALLENGE_SUCCESS = 2

_FAIL_STATE = '_FAIL_STATE'
_FIRST_STATE = '_FIRST_STATE'

_REGION_NAME = os.getenv('REGION_NAME')
_BUCKET_NAME = os.getenv('BUCKET_NAME')
_TABLE_NAME = os.getenv('TABLE_NAME')
_THREAD_POOL_SIZE = int(os.getenv('THREAD_POOL_SIZE', 10))
_SEND_ANONYMOUS_USAGE_DATA = os.getenv('SEND_ANONYMOUS_USAGE_DATA', 'False').upper() == 'TRUE'

_MAX_IMAGE_SIZE = 15728640

_extra_params = {}
if _SEND_ANONYMOUS_USAGE_DATA and 'SOLUTION_IDENTIFIER' in os.environ:
    _extra_params['user_agent_extra'] = os.environ['SOLUTION_IDENTIFIER']
config = config.Config(**_extra_params)

_s3 = boto3.client('s3', region_name=_REGION_NAME, config=config)
_rek = boto3.client('rekognition', region_name=_REGION_NAME, config=config)
_table = boto3.resource('dynamodb', region_name=_REGION_NAME, config=config).Table(_TABLE_NAME) if _TABLE_NAME else None

_challenge_types = []
_challenge_params_funcs = dict()
_challenge_state_funcs = dict()

_challenge_type_selector_func = [lambda client_metadata: secrets.choice(_challenge_types)]

_jwt_manager = JwtManager(os.getenv('TOKEN_SECRET'))


authorizer = CognitoUserPoolAuthorizer('LivenessUserPool', provider_arns=[os.getenv('COGNITO_USER_POOL_ARN',
                                                                                    '%%REF_COGNITO_USER_POOL_ARN%%')])


def challenge_type_selector(func):
    blueprint.log.debug('registering challenge_type_selector: %s', func.__name__)
    _challenge_type_selector_func[0] = func
    return func


def challenge_params(challenge_type):
    def decorator(func):
        if challenge_type not in _challenge_types:
            _challenge_types.append(challenge_type)
        _challenge_params_funcs[challenge_type] = func
        return func

    return decorator


def check_state_timeout(func, end_times, frame, timeout):
    frame_timestamp = frame['timestamp']
    if func.__name__ not in end_times:
        end_times[func.__name__] = frame_timestamp + timeout * 1000
    elif frame_timestamp > end_times[func.__name__]:
        blueprint.log.debug('State timed out: %s', frame_timestamp)
        raise _Fail


def run_state_processing_function(func, challenge, context, frame):
    try:
        res = func(challenge, frame, context)
    except Exception as e:
        blueprint.log.error('Exception: %s', e)
        raise e
    return res


def challenge_state(challenge_type, first=False, next_state=_FAIL_STATE, timeout=10):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(challenge, frame, context, end_times):
            check_state_timeout(func, end_times, frame, timeout)
            res = run_state_processing_function(func, challenge, context, frame)
            blueprint.log.debug('res: %s', res)
            # Check result
            if res == STATE_CONTINUE:
                return wrapper
            if res == STATE_NEXT:
                return _challenge_state_funcs[challenge_type][next_state]
            if res == CHALLENGE_SUCCESS:
                raise _Success
            if res == CHALLENGE_FAIL:
                raise _Fail

        # Register challenge type (if not yet)
        if challenge_type not in _challenge_types:
            _challenge_types.append(challenge_type)
        # Create challenge type's state list with default fail state (if not yet)
        if challenge_type not in _challenge_state_funcs:
            _challenge_state_funcs[challenge_type] = dict()
            _challenge_state_funcs[challenge_type][_FAIL_STATE] = lambda: CHALLENGE_FAIL
        # Register state for challenge type
        _challenge_state_funcs[challenge_type][func.__name__] = wrapper
        # Register as fist state (if first is true)
        if first:
            _challenge_state_funcs[challenge_type][_FIRST_STATE] = wrapper
        return wrapper

    return decorator


class _Success(Exception):
    pass


class _Fail(Exception):
    pass


def jwt_token_auth(func):
    def inner(challenge_id):
        blueprint.log.debug('Starting jwt_token_auth decorator')
        try:
            request = blueprint.current_request.json_body
            token = request['token']
            blueprint.log.debug(f'Authorization header (JWT): {token}')
            jwt_challenge_id = _jwt_manager.get_challenge_id(token)
            blueprint.log.debug(f'Authorization header challenge id: {jwt_challenge_id}')
            blueprint.log.debug(f'Request challenge id: {challenge_id}')
            if challenge_id != jwt_challenge_id:
                raise AssertionError()
        except Exception:
            blueprint.log.debug('Could not verify challenge id')
            raise UnauthorizedError()
        blueprint.log.debug('Challenge id successfully verified')
        return func(challenge_id)

    return inner


@blueprint.route('/challenge', methods=['POST'], cors=True, authorizer=authorizer)
def create_challenge():
    blueprint.log.debug('create_challenge')
    client_metadata = blueprint.current_request.json_body
    # Validating client metadata input
    if 'imageWidth' not in client_metadata or 'imageHeight' not in client_metadata:
        raise BadRequestError('Missing imageWidth and imageHeight')
    try:
        int(client_metadata['imageWidth'])
    except ValueError:
        raise BadRequestError('Invalid imageWidth')
    try:
        int(client_metadata['imageHeight'])
    except ValueError:
        raise BadRequestError('Invalid imageHeight')
    blueprint.log.debug('client_metadata: %s', client_metadata)
    # Saving challenge on DynamoDB table
    challenge = dict()
    challenge_id = str(uuid.uuid1())
    challenge['id'] = challenge_id
    challenge['token'] = _jwt_manager.get_jwt_token(challenge_id)
    challenge['type'] = _challenge_type_selector_func[0](client_metadata)
    challenge['params'] = _challenge_params_funcs[challenge['type']](client_metadata)
    blueprint.log.debug('challenge: %s', challenge)
    _table.put_item(Item=challenge)
    return challenge


@blueprint.route('/challenge/{challenge_id}/frame', methods=['PUT'], cors=True, authorizer=authorizer)
@jwt_token_auth
def put_challenge_frame(challenge_id):
    blueprint.log.debug('put_challenge_frame: %s', challenge_id)
    request = blueprint.current_request.json_body
    # Validating timestamp input
    try:
        timestamp = int(request['timestamp'])
    except ValueError:
        raise BadRequestError('Invalid timestamp')
    blueprint.log.debug('timestamp: %s', timestamp)
    # Validating frame input
    try:
        frame = base64.b64decode(request['frameBase64'], validate=True)
    except binascii.Error:
        raise BadRequestError('Invalid Image')
    if len(frame) > _MAX_IMAGE_SIZE:
        raise BadRequestError('Image size too large')
    if imghdr.what(None, h=frame) != 'jpeg':
        raise BadRequestError('Image must be JPEG')
    frame_key = '{}/{}.jpg'.format(challenge_id, timestamp)
    blueprint.log.debug('frame_key: %s', frame_key)
    # Updating challenge on DynamoDB table
    try:
        _table.update_item(
            Key={'id': challenge_id},
            UpdateExpression='set #frames = list_append(if_not_exists(#frames, :empty_list), :frame)',
            ExpressionAttributeNames={'#frames': 'frames'},
            ExpressionAttributeValues={
                ':empty_list': [],
                ':frame': [{
                    'timestamp': timestamp,
                    'key': frame_key
                }]
            },
            ReturnValues='NONE'
        )
    except ClientError as error:
        if error.response['Error']['Code'] == 'ConditionalCheckFailedException':
            blueprint.log.info('Challenge not found: %s', challenge_id)
            raise NotFoundError('Challenge not found')
    # Uploading frame to S3 bucket
    _s3.put_object(
        Body=frame,
        Bucket=_BUCKET_NAME,
        Key=frame_key,
        ExpectedBucketOwner=os.getenv('ACCOUNT_ID')  # Bucket Sniping prevention
    )
    return {'message': 'Frame saved successfully'}


@blueprint.route('/challenge/{challenge_id}/verify', methods=['POST'], cors=True, authorizer=authorizer)
@jwt_token_auth
def verify_challenge_response(challenge_id):
    blueprint.log.debug('verify_challenge_response: %s', challenge_id)
    # Looking up challenge on DynamoDB table
    item = _table.get_item(Key={'id': challenge_id})
    if 'Item' not in item:
        blueprint.log.info('Challenge not found: %s', challenge_id)
        raise NotFoundError('Challenge not found')
    challenge = _read_item(item['Item'])
    blueprint.log.debug('challenge: %s', challenge)
    # Getting challenge type, params and frames
    challenge_type = challenge['type']
    params = challenge['params']
    frames = challenge['frames']
    # Invoking Rekognition with parallel threads
    with ThreadPoolExecutor(max_workers=_THREAD_POOL_SIZE) as pool:
        futures = [
            pool.submit(
                _detect_faces, frame
            ) for frame in frames
        ]
        frames = [r.result() for r in as_completed(futures)]
    frames.sort(key=lambda frame: frame['key'])
    current_state = _challenge_state_funcs[challenge_type][_FIRST_STATE]
    context = dict()
    end_times = dict()
    success = False
    for frame in frames:
        try:
            while True:
                blueprint.log.debug('----------------')
                blueprint.log.debug('current_state: %s', current_state.__name__)
                blueprint.log.debug('frame[timestamp]: %s', frame['timestamp'])
                blueprint.log.debug('context.keys: %s', context.keys())
                blueprint.log.debug('end_times: %s', end_times)
                next_state = current_state(params, frame, context, end_times)
                if next_state.__name__ != current_state.__name__:
                    current_state = next_state
                    blueprint.log.debug('NEXT')
                else:
                    blueprint.log.debug('CONTINUE')
                    break
        except _Success:
            success = True
            break
        except _Fail:
            break
    # Returning result based on final state
    blueprint.log.debug('success: %s', success)
    response = {'success': success}
    blueprint.log.debug('response: %s', response)
    # Updating challenge on DynamoDB table
    _table.update_item(
        Key={'id': challenge_id},
        UpdateExpression='set #frames = :frames, #success = :success',
        ExpressionAttributeNames={
            '#frames': 'frames',
            '#success': 'success'
        },
        ExpressionAttributeValues={
            ':frames': _write_item(frames),
            ':success': response['success']
        },
        ReturnValues='NONE'
    )
    return response


def _detect_faces(frame):
    frame['rekMetadata'] = _rek.detect_faces(
        Attributes=['ALL'],
        Image={
            'S3Object': {
                'Bucket': _BUCKET_NAME,
                'Name': frame['key']
            }
        }
    )['FaceDetails']
    return frame


def _read_item(item):
    return json.loads(json.dumps(item, cls=_DecimalEncoder))


def _write_item(item):
    return json.loads(json.dumps(item), parse_float=decimal.Decimal)


# Helper class to convert a DynamoDB item to JSON.
class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            if o % 1 > 0:
                return float(o)
            return int(o)
        return super(_DecimalEncoder, self).default(o)
