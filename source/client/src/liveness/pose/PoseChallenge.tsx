/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import "./PoseChallenge.css";
import SpinnerMessage from "../components/SpinnerMessage";
import { CanvasUtils } from "../utils/CanvasUtils";
import { APIUtils, ChallengeMetadata } from "../utils/APIUtils";
import { ConfigUtils } from "../utils/ConfigUtils";
import { MediaUtils } from "../utils/MediaUtils";
import { FacePose } from "./FacePose";

const STEP_1 = "InstructionsStep";
const STEP_2 = "PoseStep";
const STEP_3 = "CheckStep";

type Props = {
  challengeMetadata: ChallengeMetadata;
  onLocalEnd: (localSuccess: boolean) => void;
  onError: (error: Error) => void;
};

type State = {
  uploading: boolean;
  stepName: string;
};

export default class PoseChallenge extends React.Component<Props, State> {
  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.state = {
      uploading: false,
      stepName: STEP_1
    };
    this.startChallenge = this.startChallenge.bind(this);
    this.takePhoto = this.takePhoto.bind(this);
    this.endChallenge = this.endChallenge.bind(this);
  }

  startChallenge() {
    this.setState({
      stepName: STEP_2
    });
  }

  takePhoto() {
    const videoWidth = MediaUtils.getMediaStreamInfo().actualWidth;
    const videoHeight = MediaUtils.getMediaStreamInfo().actualHeight;
    const flip = ConfigUtils.getConfigBooleanValue("FLIP_VIDEO");
    CanvasUtils.takePhoto("video-camera", "canvas-invisible", videoWidth, videoHeight, flip);
    CanvasUtils.drawScaledCanvasInCanvas("canvas-invisible", "canvas-photo-check");
    this.setState({
      stepName: STEP_3
    });
  }

  endChallenge() {
    const base64Photo = CanvasUtils.getPhotoFromCanvas("canvas-invisible", ConfigUtils.getConfig().IMAGE_JPG_QUALITY);
    this.setState({
      uploading: true
    });
    const self = this;
    APIUtils.putChallengeFrame(
      this.props.challengeMetadata.id,
      this.props.challengeMetadata.token,
      base64Photo,
      Date.now()
    )
      .then(() => this.props.onLocalEnd(true))
      .catch(error => this.props.onError(error))
      .finally(() => {
        self.setState({
          uploading: false
        });
      });
  }

  componentDidMount() {
    CanvasUtils.setVideoElementSrc("video-camera", MediaUtils.getMediaStreamInfo().mediaStream);
    // @ts-ignore
    const pose = this.props.challengeMetadata.params.pose;
    for (const canvasElementId of ["canvas-pose-big", "canvas-pose-small", "canvas-pose-check"]) {
      new FacePose(pose.eyes, pose.mouth).draw(canvasElementId);
    }
  }

  render() {
    const videoWidth = MediaUtils.getMediaStreamInfo().actualWidth;
    const videoHeight = MediaUtils.getMediaStreamInfo().actualHeight;
    const shouldRotate = ConfigUtils.getConfigBooleanValue("FLIP_VIDEO");

    return (
      <div className="container">
        {!this.state.uploading && (
          <div>
            <div className={this.state.stepName !== STEP_1 ? "hidden" : ""}>
              {/* <button type="button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="bi bi-arrow-left"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
                  />
                </svg>
              </button> */}

              <h4 className="h4 font-weight-bold mt-5">Get ready to copy the pose</h4>
              <p className="gray-darker mx-5">In the next step, copy the facial expression shown below.</p>
              <div className="my-4">
                <canvas id="canvas-pose-big" width={videoWidth} height={videoHeight} />
              </div>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={this.startChallenge}>
                Start Challenge
              </button>
            </div>
            <div className={this.state.stepName !== STEP_2 ? "hidden" : "p-relative"}>
              <h4 className="h34 font-weight-bold mt-3">Copy the pose</h4>
              <p className="gray-darker mx-5">Avoid rotating your face and make sure it is well-illuminated.</p>
              <div className="videoContainer mx-auto" style={{ width: videoWidth }}>
                <canvas id="canvas-invisible" style={{ display: "none" }} />
                <video
                  id="video-camera"
                  className={shouldRotate ? "rotate" : ""}
                  width={videoWidth}
                  height={videoHeight}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: videoWidth, height: videoHeight }}
                />
                <canvas
                  id="canvas-pose-small"
                  width="100"
                  height="100"
                  style={{
                    left: videoWidth - 105,
                    top: 10,
                    position: "absolute",
                    objectFit: "contain"
                  }}
                />
                {/* <div id="text-info" style={{ width: videoWidth, top: videoHeight - 50, position: "absolute" }}>
                  Avoid rotating your face and make sure it is well-illuminated.
                </div> */}
              </div>
              <button
                style={{ position: "absolute", top: MediaUtils.getMediaStreamInfo().actualHeight + 96 + "px" }}
                type="button"
                className="btn btn-primary btn-lg btn-block take-button"
                onClick={this.takePhoto}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="bi bi-camera mr-2"
                  viewBox="0 0 16 16"
                >
                  <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z" />
                  <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" />
                </svg>
                Take picture
              </button>
            </div>
            <div className={this.state.stepName !== STEP_3 ? "hidden" : ""}>
              <h4 className="font-weight-bold mt-5">Do these pictures match?</h4>
              <p className="gray-darker">Check if your pose is as similar as possible.</p>
              <div className="my-4 d-flex justify-content-center check-canvas">
                <canvas id="canvas-photo-check" width={videoWidth / 2} height={videoHeight / 2} />
                <canvas id="canvas-pose-check" width={videoWidth / 2} height={videoHeight / 2} />
              </div>
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-lg mr-4 w-50"
                  onClick={this.startChallenge}
                >
                  Retake
                </button>
                <button type="button" className="btn btn-primary btn-lg w-50" onClick={this.endChallenge}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        {this.state.uploading && <SpinnerMessage message={"Uploading..."} />}
      </div>
    );
  }
}
