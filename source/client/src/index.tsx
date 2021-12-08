/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import ReactDOM from "react-dom";
import { AmplifyAuthenticator } from "@aws-amplify/ui-react";

import LivenessDetection from "./liveness/LivenessDetection";

ReactDOM.render(
  <React.StrictMode>
    <AmplifyAuthenticator>
      <LivenessDetection />
    </AmplifyAuthenticator>
  </React.StrictMode>,
  document.getElementById("root")
);
