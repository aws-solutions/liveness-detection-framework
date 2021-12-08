/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AmplifySignOut } from "@aws-amplify/ui-react";
// @ts-ignore
import Lottie from "react-lottie";
import { MediaUtils } from "../utils/MediaUtils";
import * as welcomeData from "./lottie/intro.json";
import "./Welcome.css";
import faceChallenge from "./assets/pose.png";

type Props = {
  onStart: (challengeType: string) => void;
  onError: (error: Error) => void;
  loading: boolean;
};

type State = {
  mediaStreamReady: boolean;
  challengeType: string;
};

export default class Welcome extends React.Component<Props, State> {
  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.state = { mediaStreamReady: false, challengeType: "" };
    this.onChallengeTypeChanged = this.onChallengeTypeChanged.bind(this);
  }

  onChallengeTypeChanged(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      challengeType: event.target.value
    });
  }

  componentDidMount() {
    MediaUtils.loadMediaStream(
      () => {
        this.setState({ mediaStreamReady: true });
      },
      message => {
        this.props.onError(Error(message));
      }
    );
  }

  render() {
    const lottieOptions = {
      // @ts-ignore
      animationData: welcomeData.default,
      loop: true
    };

    return (
      <>
        <div className="header">
          <div className="container">
            <h4 className="display-4 title-background">
              Liveness Detection <span>Framework</span>
            </h4>

            <h3 className="h5 mb-3 text-left gray-darker">Choose one challenge to validate liveness</h3>
            <div
              className="challenge-options d-flex justify-content-between"
              onClick={() => this.setState({ challengeType: "NOSE" })}
            >
              <div className="d-flex align-items-start">
                <input
                  type="radio"
                  name="exampleRadios"
                  id="exampleRadios1"
                  value="NOSE"
                  checked={this.state.challengeType === "NOSE"}
                  onChange={this.onChallengeTypeChanged}
                />
                <div className="option-content">
                  <label htmlFor="exampleRadios">Nose challenge</label>
                  <p className="small">Place the tip of your nose in the target area</p>
                </div>
              </div>
              {/* <img src={noseChallenge} alt="Nose Challenge" className="challenge-image" /> */}
              <Lottie
                options={lottieOptions}
                style={{
                  width: 104,
                  height: 104,
                  margin: -10
                }}
              />
            </div>
            <div
              className="challenge-options d-flex justify-content-between"
              onClick={() => this.setState({ challengeType: "POSE" })}
            >
              <div className="d-flex align-items-start ">
                <input
                  type="radio"
                  name="exampleRadios"
                  id="exampleRadios2"
                  value="POSE"
                  checked={this.state.challengeType === "POSE"}
                  onChange={this.onChallengeTypeChanged}
                />
                <div className="option-content">
                  <label htmlFor="exampleRadios">Pose challenge</label>
                  <p className="small">Copy a facial expression</p>
                </div>
              </div>
              <img src={faceChallenge} alt="Face Challenge" className="challenge-image" />
            </div>

            {!this.props.loading && (
              <button
                type="button"
                disabled={!this.state.mediaStreamReady}
                className="btn btn-primary btn-lg mt-4 btn-block shadow"
                onClick={() => this.props.onStart(this.state.challengeType)}
              >
                Verify now!
              </button>
            )}
            {this.props.loading && <div className="spinner-border mt-5" role="status" />}
          </div>
          <div className="d-flex justify-content-center mt-5">
            <div>
              <AmplifySignOut />
            </div>
          </div>
        </div>
      </>
    );
  }
}
