# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import math
import secrets

import numpy as np

from .framework import STATE_NEXT, STATE_CONTINUE, CHALLENGE_SUCCESS, CHALLENGE_FAIL
from .framework import challenge_params, challenge_state

_AREA_BOX_WIDTH_RATIO = 0.75
_AREA_BOX_HEIGHT_RATIO = 0.75
_AREA_BOX_ASPECT_RATIO = 0.75
_AREA_BOX_TOLERANCE = 0.05
_MIN_FACE_AREA_PERCENT = 40
_MIN_FACE_AREA_PERCENT_TOLERANCE = 20
_NOSE_BOX_SIZE = 20
_NOSE_BOX_CENTER_MIN_H_DIST = 45
_NOSE_BOX_CENTER_MAX_H_DIST = 75
_NOSE_BOX_CENTER_MAX_V_DIST = 40
_NOSE_BOX_TOLERANCE = 0.55
_TRAJECTORY_ERROR_THRESHOLD = 0.02
_HISTOGRAM_BINS = 3
_MIN_DIST = 0.10
_ROTATION_THRESHOLD = 5.0
_MIN_DIST_FACTOR_ROTATED = 0.75
_MIN_DIST_FACTOR_NOT_ROTATED = 1.5

_log = logging.getLogger('liveness-backend')


@challenge_params(challenge_type='NOSE')
def nose_challenge_params(client_metadata):
    image_width = int(client_metadata['imageWidth'])
    image_height = int(client_metadata['imageHeight'])
    area_x, area_y, area_w, area_h = _get_area_box(image_width, image_height)
    nose_x, nose_y, nose_w, nose_h = _get_nose_box(image_width, image_height)
    params = dict()
    params['imageWidth'] = image_width
    params['imageHeight'] = image_height
    params['areaLeft'] = int(area_x)
    params['areaTop'] = int(area_y)
    params['areaWidth'] = int(area_w)
    params['areaHeight'] = int(area_h)
    params['minFaceAreaPercent'] = _MIN_FACE_AREA_PERCENT
    params['noseLeft'] = int(nose_x)
    params['noseTop'] = int(nose_y)
    params['noseWidth'] = int(nose_w)
    params['noseHeight'] = int(nose_h)
    return params


@challenge_state(challenge_type='NOSE', first=True, next_state='area_state')
def face_state(_params, frame, _context):
    if len(frame['rekMetadata']) == 1:
        return STATE_NEXT
    return STATE_CONTINUE


@challenge_state(challenge_type='NOSE', next_state='nose_state')
def area_state(params, frame, _context):
    image_width = params['imageWidth']
    image_height = params['imageHeight']

    # Validating if face is inside area
    area_box = (params['areaLeft'], params['areaTop'],
                params['areaWidth'], params['areaHeight'])
    rek_metadata = frame['rekMetadata'][0]
    rek_face_box = [
        image_width * rek_metadata['BoundingBox']['Left'],
        image_height * rek_metadata['BoundingBox']['Top'],
        image_width * rek_metadata['BoundingBox']['Width'],
        image_height * rek_metadata['BoundingBox']['Height']
    ]
    inside_area_box = _is_inside_area_box(area_box, rek_face_box)
    _log.debug('inside_area_box: %s', inside_area_box)
    if not inside_area_box:
        return STATE_CONTINUE

    # Validating if face area is larger than minimal
    area_box_area = area_box[2] * area_box[3]
    rek_face_box_area = rek_face_box[2] * rek_face_box[3]
    rek_face_area_percent = rek_face_box_area * 100 / area_box_area
    gte_min_face_area = rek_face_area_percent + _MIN_FACE_AREA_PERCENT_TOLERANCE >= params['minFaceAreaPercent']
    _log.debug('gte_min_face_area: %s', gte_min_face_area)
    if gte_min_face_area:
        return STATE_NEXT
    return STATE_CONTINUE


@challenge_state(challenge_type='NOSE')
def nose_state(params, frame, context):
    init_context(context, frame)

    image_width = params['imageWidth']
    image_height = params['imageHeight']

    # Validating if face is inside area (with tolerance)
    area_width_tolerance = params['areaWidth'] * _AREA_BOX_TOLERANCE
    area_height_tolerance = params['areaHeight'] * _AREA_BOX_TOLERANCE
    area_box = (params['areaLeft'] - area_width_tolerance,
                params['areaTop'] - area_height_tolerance,
                params['areaWidth'] + 2 * area_width_tolerance,
                params['areaHeight'] + 2 * area_height_tolerance)
    rek_metadata = frame['rekMetadata'][0]
    rek_face_box = [
        image_width * rek_metadata['BoundingBox']['Left'],
        image_height * rek_metadata['BoundingBox']['Top'],
        image_width * rek_metadata['BoundingBox']['Width'],
        image_height * rek_metadata['BoundingBox']['Height']
    ]
    inside_area_box = _is_inside_area_box(area_box, rek_face_box)
    _log.debug('inside_area_box: %s', inside_area_box)
    if not inside_area_box:
        return CHALLENGE_FAIL

    # Validating nose position (with tolerance)
    nose_width_tolerance = params['noseWidth'] * _NOSE_BOX_TOLERANCE
    nose_height_tolerance = params['noseHeight'] * _NOSE_BOX_TOLERANCE
    nose_box = (params['noseLeft'] - nose_width_tolerance,
                params['noseTop'] - nose_height_tolerance,
                params['noseWidth'] + 2 * nose_width_tolerance,
                params['noseHeight'] + 2 * nose_height_tolerance)
    rek_landmarks = rek_metadata['Landmarks']
    inside_nose_box = False
    for landmark in rek_landmarks:
        if landmark['Type'] == 'nose':
            nose_left = image_width * landmark['X']
            nose_top = image_height * landmark['Y']
            context['nose_trajectory'].append((landmark['X'], landmark['Y']))
            inside_nose_box = (nose_box[0] <= nose_left <= nose_box[0] + nose_box[2] and
                               nose_box[1] <= nose_top <= nose_box[1] + nose_box[3])
    _log.debug('inside_nose_box: %s', inside_nose_box)
    if not inside_nose_box:
        return STATE_CONTINUE

    # Validating continuous and linear nose trajectory
    nose_trajectory_x = [nose[0] for nose in context['nose_trajectory']]
    nose_trajectory_y = [nose[1] for nose in context['nose_trajectory']]
    # noinspection PyTupleAssignmentBalance
    _, residuals, _, _, _ = np.polyfit(nose_trajectory_x, nose_trajectory_y, 2, full=True)
    trajectory_error = math.sqrt(residuals / len(context['nose_trajectory']))
    if trajectory_error > _TRAJECTORY_ERROR_THRESHOLD:
        _log.info('invalid_trajectory')
        return CHALLENGE_FAIL

    # Plotting landmarks from the first frame in a histogram
    original_landmarks_x = [image_width * landmark['X'] for landmark in context['original_landmarks']]
    original_landmarks_y = [image_height * landmark['Y'] for landmark in context['original_landmarks']]
    original_histogram, _, _ = np.histogram2d(original_landmarks_x,
                                              original_landmarks_y,
                                              bins=_HISTOGRAM_BINS)
    original_histogram = np.reshape(original_histogram, _HISTOGRAM_BINS ** 2) / len(
        original_landmarks_x)
    # Plotting landmarks from the last frame in a histogram
    current_landmarks_x = [image_width * landmark['X'] for landmark in rek_landmarks]
    current_landmarks_y = [image_height * landmark['Y'] for landmark in rek_landmarks]
    current_histogram, _, _ = np.histogram2d(current_landmarks_x,
                                             current_landmarks_y,
                                             bins=_HISTOGRAM_BINS)
    current_histogram = np.reshape(current_histogram, _HISTOGRAM_BINS ** 2) / len(current_landmarks_x)
    # Calculating the Euclidean distance between histograms
    dist = np.linalg.norm(original_histogram - current_histogram)
    # Estimating left and right rotation
    yaw = rek_metadata['Pose']['Yaw']
    rotated_right = yaw > _ROTATION_THRESHOLD
    rotated_left = yaw < - _ROTATION_THRESHOLD
    rotated_face = rotated_left or rotated_right
    # Validating distance according to rotation
    challenge_in_the_right = params['noseLeft'] + _NOSE_BOX_SIZE / 2 > image_width / 2
    if (rotated_right and challenge_in_the_right) or (rotated_left and not challenge_in_the_right):
        min_dist = _MIN_DIST * _MIN_DIST_FACTOR_ROTATED
    elif not rotated_face:
        min_dist = _MIN_DIST * _MIN_DIST_FACTOR_NOT_ROTATED
    else:
        _log.info('invalid_rotation')
        return CHALLENGE_FAIL
    if dist > min_dist:
        _log.info('valid_distance')
        return CHALLENGE_SUCCESS
    _log.info('invalid_distance')
    return CHALLENGE_FAIL


def init_context(context, frame):
    if 'original_landmarks' not in context:
        context['original_landmarks'] = frame['rekMetadata'][0]['Landmarks']
    if 'nose_trajectory' not in context:
        context['nose_trajectory'] = []


def _get_area_box(image_width, image_height):
    area_height = image_height * _AREA_BOX_HEIGHT_RATIO
    area_width = min(
        image_width * _AREA_BOX_WIDTH_RATIO,
        area_height * _AREA_BOX_ASPECT_RATIO
    )
    area_left = image_width / 2 - area_width / 2
    area_top = image_height / 2 - area_height / 2
    return (area_left,
            area_top,
            area_width,
            area_height)


def _get_nose_box(image_width, image_height):
    width = _NOSE_BOX_SIZE
    height = _NOSE_BOX_SIZE
    multiplier = secrets.choice([1, -1])
    left = image_width / 2 + (
            multiplier *
            (_NOSE_BOX_CENTER_MIN_H_DIST + secrets.randbelow(_NOSE_BOX_CENTER_MAX_H_DIST - _NOSE_BOX_CENTER_MIN_H_DIST))
    )
    if multiplier == -1:
        left = left - width
    multiplier = secrets.choice([1, -1])
    top = image_height / 2 + (
            multiplier *
            secrets.randbelow(_NOSE_BOX_CENTER_MAX_V_DIST)
    )
    if multiplier == -1:
        top = top - height
    return [left, top, width, height]


def _is_inside_area_box(area_box, face_box):
    return (area_box[0] <= face_box[0] and area_box[1] <= face_box[1] and
            area_box[0] + area_box[2] >= face_box[0] + face_box[2] and
            area_box[1] + area_box[3] >= face_box[1] + face_box[3])
