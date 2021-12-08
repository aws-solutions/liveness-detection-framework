/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Hub } from "aws-amplify";
import "./LivenessDetection.css";
import "./app.scss";
import Welcome from "./components/Welcome";
import SpinnerMessage from "./components/SpinnerMessage";
import ResultMessage from "./components/ResultMessage";
import ErrorMessage from "./components/ErrorMessage";
import NoseChallenge from "./nose/NoseChallenge";
import PoseChallenge from "./pose/PoseChallenge";
import { APIUtils, ChallengeMetadata, ChallengeResult } from "./utils/APIUtils";
import { LogUtils } from "./utils/LogUtils";

type Props = Record<string, never>;

type State = {
  challengeMetadata: ChallengeMetadata;
  success: boolean;
  step: number;
  errorMessage: string;
  loading: boolean;
};

export default class LivenessDetection extends React.Component<Props, State> {
  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.state = {
      challengeMetadata: {
        id: "",
        token: "",
        type: "",
        params: {}
      },
      success: false,
      step: 1,
      errorMessage: "",
      loading: false
    };
    this.onStart = this.onStart.bind(this);
    this.onLocalEnd = this.onLocalEnd.bind(this);
    this.onRestart = this.onRestart.bind(this);
    this.onError = this.onError.bind(this);

    Hub.listen("auth", (data: any): void => {
      if (data.payload.event === "signOut") {
        window.location.reload();
      }
    });
  }

  onStart(challengeType: string): void {
    this.setState({
      loading: true
    });
    const self = this;
    APIUtils.startChallenge(challengeType)
      .then((challengeMetadata: ChallengeMetadata) => {
        this.setState({ challengeMetadata: challengeMetadata });
        this.setState({ step: 2 });
      })
      .catch((error: Error) => {
        this.onError(error);
      })
      .finally(() => {
        self.setState({
          loading: false
        });
      });
  }

  onLocalEnd(localSuccess: boolean): void {
    if (localSuccess) {
      this.setState({ step: 3 });
      APIUtils.verifyChallenge(this.state.challengeMetadata.id, this.state.challengeMetadata.token)
        .then((result: ChallengeResult) => {
          this.setState({ success: result.success });
          this.setState({ step: 4 });
        })
        .catch((error: Error) => {
          this.onError(error);
        });
    } else {
      this.setState({ success: false });
      this.setState({ step: 4 });
    }
  }

  onRestart(): void {
    this.setState({ step: 1 });
  }

  onError(error: Error): void {
    LogUtils.error(error);
    this.setState({ errorMessage: error.name + ": " + error.message });
    this.setState({ step: -1 });
  }

  render() {
    return (
      <div className="LivenessDetection">
        {this.state.step === 1 && (
          <Welcome onStart={this.onStart} onError={this.onError} loading={this.state.loading} />
        )}
        {this.state.step === 2 && this.state.challengeMetadata.type === "NOSE" && (
          <NoseChallenge
            challengeMetadata={this.state.challengeMetadata}
            onLocalEnd={this.onLocalEnd}
            onError={this.onError}
          />
        )}
        {this.state.step === 2 && this.state.challengeMetadata.type === "POSE" && (
          <PoseChallenge
            challengeMetadata={this.state.challengeMetadata}
            onLocalEnd={this.onLocalEnd}
            onError={this.onError}
          />
        )}
        {this.state.step === 3 && <SpinnerMessage message={"Verifying..."} />}
        {this.state.step === 4 && <ResultMessage success={this.state.success} onRestart={this.onRestart} />}
        {this.state.step === -1 && <ErrorMessage message={this.state.errorMessage} onRestart={this.onRestart} />}
      </div>
    );
  }
}
