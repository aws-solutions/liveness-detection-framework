/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
// @ts-ignore
import Lottie from "react-lottie";
import * as successData from "./lottie/success.json";
import * as failData from "./lottie/fail.json";
import positiveFace from "./assets/positive.png";
import negativeFace from "./assets/negative.png";
import "./ResultMessage.css";

const SUCCESS_TITLE = "Liveness verified";
const SUCCESS_MESSAGE = "Successfully verified as a live person.";
const SUCCESS_BUTTON = "Start another challenge";
const FAIL_TITLE = "Unable to validate liveness";
const FAIL_MESSAGE =
  "Pay attention to the eyes, the mouth or the tip of your nose, depending on the challenge. Make sure your face is well-illuminated";
const FAIL_BUTTON = "Try again";

type Props = {
  success: boolean;
  onRestart: () => void;
};

export default class ResultMessage extends React.Component<Props> {
  render() {
    const title = this.props.success ? SUCCESS_TITLE : FAIL_TITLE;
    const message = this.props.success ? SUCCESS_MESSAGE : FAIL_MESSAGE;
    const buttonText = this.props.success ? SUCCESS_BUTTON : FAIL_BUTTON;
    const resultImg = this.props.success ? positiveFace : negativeFace;
    const lottieOptions = {
      // @ts-ignore
      animationData: this.props.success ? successData.default : failData.default,
      loop: false
    };

    return (
      <div className="text-center container">
        <div className="result-frame">
          <div className="result-animation">
            <Lottie options={lottieOptions} height={56} width={56} />
          </div>
          <img src={resultImg} alt="Positive face" className="result-face" />
        </div>
        <h2 className="mt-5 font-weight-bold">{title}</h2>
        <p className="mt-2 gray-darker">{message}</p>
        <button type="button" className="btn btn-primary btn-lg mt-5 btn-block" onClick={this.props.onRestart}>
          {buttonText}
        </button>
      </div>
    );
  }
}
