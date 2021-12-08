/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import "./NoseChallenge.css";
// @ts-ignore
import Lottie from "react-lottie";
import SpinnerMessage from "../components/SpinnerMessage";
import { NoseChallengeProcessor } from "./NoseChallengeProcessor";
import { ChallengeMetadata } from "../utils/APIUtils";
import { ConfigUtils } from "../utils/ConfigUtils";
import { MediaUtils } from "../utils/MediaUtils";
import * as help1 from "./lottie/help1.json";
import * as help2 from "./lottie/help2.json";

type Props = {
  challengeMetadata: ChallengeMetadata;
  onLocalEnd: (localSuccess: boolean) => void;
  onError: (error: Error) => void;
};

type State = {
  message: string;
  animation: number;
  localSuccess: boolean;
  uploading: boolean;
};

export default class NoseChallenge extends React.Component<Props, State> {
  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.state = {
      message: "Loading...",
      animation: -1,
      localSuccess: false,
      uploading: false
    };
    this.onHelpMessage = this.onHelpMessage.bind(this);
    this.onHelpAnimation = this.onHelpAnimation.bind(this);
    this.onLocalEnd = this.onLocalEnd.bind(this);
    this.onUploadEnd = this.onUploadEnd.bind(this);
  }

  componentDidMount() {
    // Make sure all models are loaded before starting frame processing
    NoseChallengeProcessor.loadModels().then(() => {
      new NoseChallengeProcessor(
        this.props.challengeMetadata,
        "cameraVideo",
        "overlayCanvas",
        this.onLocalEnd,
        this.onUploadEnd,
        this.onHelpMessage,
        this.onHelpAnimation
      ).start();
    });
  }

  onLocalEnd(localSuccess: boolean) {
    this.setState({ uploading: true });
    this.setState({ localSuccess: localSuccess });
  }

  onUploadEnd() {
    this.props.onLocalEnd(this.state.localSuccess);
  }

  onHelpMessage(message: string | undefined): void {
    this.setState({ message: message || "" });
  }

  onHelpAnimation(animationNumber: number | undefined): void {
    this.setState({ animation: animationNumber || -1 });
  }

  render() {
    const videoWidth = MediaUtils.getMediaStreamInfo().actualWidth;
    const videoHeight = MediaUtils.getMediaStreamInfo().actualHeight;
    const shouldRotate = ConfigUtils.getConfigBooleanValue("FLIP_VIDEO");
    // @ts-ignore
    const lottieOptions1 = { animationData: help1.default };
    // @ts-ignore
    const lottieOptions2 = { animationData: help2.default };

    return (
      <div>
        {!this.state.uploading && (
          <div className="videoContainer mx-auto" style={{ width: videoWidth }}>
            <video
              id="cameraVideo"
              className={shouldRotate ? "rotate" : ""}
              width={videoWidth}
              height={videoHeight}
              autoPlay
              muted
              playsInline
              style={{ width: videoWidth, height: videoHeight }}
            />
            <canvas
              id="overlayCanvas"
              className={shouldRotate ? "rotate" : ""}
              width={videoWidth}
              height={videoHeight}
            />
            <div
              className="helpContainer clearfix"
              style={{ paddingTop: MediaUtils.getMediaStreamInfo().actualHeight + 5 + "px" }}
            >
              <div className="float-left messageContainer">
                <div className="message">
                  <h5>{this.state.message}</h5>
                </div>
              </div>
              <div className="float-right">
                {this.state.animation === 1 && <Lottie options={lottieOptions1} height={100} width={100} />}
                {this.state.animation === 2 && <Lottie options={lottieOptions2} height={100} width={100} />}
              </div>
            </div>
          </div>
        )}
        {this.state.uploading && <SpinnerMessage message={"Uploading..."} />}
      </div>
    );
  }
}
