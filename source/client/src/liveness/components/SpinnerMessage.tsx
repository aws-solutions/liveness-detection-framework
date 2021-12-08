/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import thinkingFace from "./assets/thinking.svg";
import eyes from "./assets/eyes.svg";
import "./SpinnerMessage.css";

type Props = {
  message: string;
};

export default class SpinnerMessage extends React.Component<Props> {
  render() {
    return (
      <div className="text-center mt-5">
        <div className="spinner-frame">
          <img src={thinkingFace} alt="Thinking face" className="thinking-face" />
          <img src={eyes} alt="Eyes" className="eyes-face" />
        </div>
        <h2 className="mt-5 font-weight-bold">{this.props.message}</h2>
        <p className="mt-2 gray-darker">Wait few seconds</p>
      </div>
    );
  }
}
