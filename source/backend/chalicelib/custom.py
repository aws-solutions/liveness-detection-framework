# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from .framework import STATE_NEXT, CHALLENGE_SUCCESS  # , STATE_CONTINUE, CHALLENGE_FAIL
from .framework import challenge_params, challenge_state

_log = logging.getLogger('liveness-backend')


@challenge_params(challenge_type='CUSTOM')
def custom_challenge_params(client_metadata):
    params = dict()
    params.update(client_metadata)
    return params


@challenge_state(challenge_type='CUSTOM', first=True, next_state='second_state')
def first_state(_params, _frame, _context):
    # To continue in the same state, use 'return STATE_CONTINUE' instead
    return STATE_NEXT


@challenge_state(challenge_type='CUSTOM', next_state='second_state')
def second_state(_params, _frame, _context):
    # To continue in the same state, use 'return STATE_CONTINUE' instead
    return STATE_NEXT


@challenge_state(challenge_type='CUSTOM')
def last_state(_params, _frame, _context):
    # If the challenge fails, use 'return CHALLENGE_FAIL' instead
    return CHALLENGE_SUCCESS
