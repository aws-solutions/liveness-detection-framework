# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import secrets

from .framework import challenge_params, challenge_state
from .framework import CHALLENGE_SUCCESS, CHALLENGE_FAIL

_log = logging.getLogger('liveness-backend')

POSE_EYS = ['OPEN', 'CLOSED', 'LOOKING_LEFT', 'LOOKING_RIGHT']
POSE_MOUTH = ['CLOSED', 'SMILE']

REKOGNITION_FACE_MIN_CONFIDENCE = 90
REKOGNITION_FACE_MAX_ROTATION = 20
EYE_DIRECTION_AREA_MULTIPLIER = 1.2  # the bigger the value, more permissive


@challenge_params(challenge_type='POSE')
def pose_challenge_params(client_metadata):
    image_width = int(client_metadata['imageWidth'])
    image_height = int(client_metadata['imageHeight'])
    params = dict()
    params['imageWidth'] = image_width
    params['imageHeight'] = image_height
    params['pose'] = {
        'eyes': secrets.choice(POSE_EYS),
        'mouth': secrets.choice(POSE_MOUTH)
    }
    return params


@challenge_state(challenge_type='POSE', first=True)
def first_state(params, frame, _context):
    _log.debug(f'Params: {params}')
    _log.debug(f'Frame: {frame}')

    faces = frame['rekMetadata']
    num_faces = len(faces)
    _log.debug(f'Number of faces: {num_faces}')
    if num_faces != 1:
        _log.info(f'FAIL: Number of faces. Expected: 1 Actual: {num_faces}')
        return CHALLENGE_FAIL

    face = faces[0]
    confidence = face['Confidence']
    _log.debug(f'Confidence: {confidence}')
    if face['Confidence'] < REKOGNITION_FACE_MIN_CONFIDENCE:
        _log.info(f'FAIL: Confidence. Expected: {REKOGNITION_FACE_MIN_CONFIDENCE} Actual: {confidence}')
        return CHALLENGE_FAIL

    rotation_pose = face['Pose']
    _log.debug(f'Rotation: {rotation_pose}')
    if _is_rotated(rotation_pose):
        _log.info(f'FAIL: Face rotation. Expected: {REKOGNITION_FACE_MAX_ROTATION} Actual: {rotation_pose}')
        return CHALLENGE_FAIL

    expected_eyes = params['pose']['eyes']
    if not _are_eyes_correct(expected_eyes, face):
        _log.info(f'FAIL: Eyes. Expected: {expected_eyes}')
        return CHALLENGE_FAIL

    expected_mouth = params['pose']['mouth']
    if not _is_mouth_correct(expected_mouth, face):
        _log.info(f'FAIL: Mouth. Expected: {expected_mouth}')
        return CHALLENGE_FAIL

    _log.info(f'Success!')
    return CHALLENGE_SUCCESS


def _is_rotated(pose):
    return (abs(pose['Roll']) > REKOGNITION_FACE_MAX_ROTATION or
            abs(pose['Yaw']) > REKOGNITION_FACE_MAX_ROTATION or
            abs(pose['Pitch']) > REKOGNITION_FACE_MAX_ROTATION)


def _is_mouth_correct(expected, face):
    should_smile = expected == 'SMILE'
    is_smiling = face['Smile']['Value']
    is_mouth_open = face['MouthOpen']['Value']
    _log.debug(f'Smiling: {is_smiling} Mouth open: {is_mouth_open}')
    return (should_smile and is_smiling and is_mouth_open) or (
                not should_smile and not is_smiling and not is_mouth_open)


def _are_eyes_correct(expected, face):
    are_open = face['EyesOpen']['Value']
    _log.debug(f'Eyes open: {are_open}')
    if (expected == 'CLOSED' and are_open) or (expected != 'CLOSED' and not are_open):
        return False

    eye_left, eye_right = _get_eyes_coordinates(face['Landmarks'])
    _log.debug(f'Eyes coordinates - Left: {eye_left} Right: {eye_right}')
    eye_left_direction = _get_eye_direction(eye_left)
    _log.debug(f'Left eye direction: {eye_left_direction}')
    if _is_eye_opposite_direction(eye_left_direction, expected):
        _log.debug(f'Wrong left eye direction. Expected: {expected} Actual: {eye_left_direction}')
        return False
    eye_right_direction = _get_eye_direction(eye_right)
    _log.debug(f'Right eye direction: {eye_right_direction}')
    if _is_eye_opposite_direction(eye_right_direction, expected):
        _log.debug(f'Wrong right eye direction. Expected: {expected} Actual: {eye_right_direction}')
        return False
    return True


def _get_eyes_coordinates(landmarks):
    eye_left = {}
    eye_right = {}
    for landmark in landmarks:
        if landmark['Type'] == 'rightEyeLeft':
            eye_right['left'] = {'x': landmark['X'], 'y': landmark['Y']}
        elif landmark['Type'] == 'rightEyeRight':
            eye_right['right'] = {'x': landmark['X'], 'y': landmark['Y']}
        elif landmark['Type'] == 'rightPupil':
            eye_right['pupil'] = {'x': landmark['X'], 'y': landmark['Y']}
        elif landmark['Type'] == 'leftEyeLeft':
            eye_left['left'] = {'x': landmark['X'], 'y': landmark['Y']}
        elif landmark['Type'] == 'leftEyeRight':
            eye_left['right'] = {'x': landmark['X'], 'y': landmark['Y']}
        elif landmark['Type'] == 'leftPupil':
            eye_left['pupil'] = {'x': landmark['X'], 'y': landmark['Y']}
    return eye_left, eye_right


def _get_eye_direction(eye):
    one_third_of_eye_width = (eye['right']['x'] - eye['left']['x']) / 3
    if eye['pupil']['x'] <= eye['left']['x'] + one_third_of_eye_width * EYE_DIRECTION_AREA_MULTIPLIER:
        return 'LOOKING_LEFT'
    elif eye['pupil']['x'] >= eye['right']['x'] - one_third_of_eye_width * EYE_DIRECTION_AREA_MULTIPLIER:
        return 'LOOKING_RIGHT'
    return 'OPEN'


def _is_eye_opposite_direction(direction, expected):
    return (direction == 'LOOKING_LEFT' and expected == 'LOOKING_RIGHT') or (
                direction == 'LOOKING_RIGHT' and expected == 'LOOKING_LEFT')
