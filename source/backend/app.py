# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import secrets
from importlib import import_module

from chalice import Chalice

from chalicelib.framework import blueprint, challenge_type_selector

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
CLIENT_CHALLENGE_SELECTION = os.getenv('CLIENT_CHALLENGE_SELECTION', "False").upper() == 'TRUE'

app = Chalice(app_name='liveness-backend')
app.log.setLevel(LOG_LEVEL)
app.register_blueprint(blueprint)

import_module('chalicelib.nose')
import_module('chalicelib.pose')
import_module('chalicelib.custom')


@challenge_type_selector
def random_challenge_selector(client_metadata):
    app.log.debug('random_challenge_selector')
    if CLIENT_CHALLENGE_SELECTION and 'challengeType' in client_metadata:
        return client_metadata['challengeType']
    return secrets.choice(['POSE', 'NOSE'])
