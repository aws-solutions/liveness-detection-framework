/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as faceapi from "face-api.js";
import { NoseChallengeParams } from "./NoseChallengeParams";
import { DrawOptions } from "./OverlayCanvasDrawer";
import { State, StateOutput, FaceState, NoseState, FailState, SuccessState } from "./States";
import { LogUtils } from "../utils/LogUtils";

export interface StateManagerOutput {
  readonly end: boolean;
  readonly success?: boolean;
  readonly shouldSaveFrame: boolean;
  readonly drawOptions?: DrawOptions;
  readonly helpMessage?: string;
  readonly helpAnimationNumber?: number;
}

export class StateManager {
  private readonly noseChallengeParams: NoseChallengeParams;

  private currentState!: State;
  private endTime!: number;

  constructor(noseChallengeParams: NoseChallengeParams) {
    this.noseChallengeParams = noseChallengeParams;
    this.changeCurrentState(new FaceState(this.noseChallengeParams));
  }

  process(
    result: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ): StateManagerOutput {
    LogUtils.debug(`current state: ${this.currentState.getName()}`);

    if (this.endTime > 0 && Date.now() / 1000 > this.endTime) {
      LogUtils.info(`fail: state timed out`);
      this.changeCurrentState(new FailState(this.noseChallengeParams));
    }
    const stateOutput: StateOutput = this.currentState.process(result);
    if (stateOutput.nextState) {
      this.changeCurrentState(stateOutput.nextState);
    }

    let end = false;
    let shouldSaveFrame = false;
    let success;
    if (this.currentState.getName() === SuccessState.NAME) {
      end = true;
      success = true;
      shouldSaveFrame = true;
    } else if (this.currentState.getName() === FailState.NAME) {
      end = true;
      success = false;
    } else if (this.currentState.getName() === NoseState.NAME) {
      shouldSaveFrame = true;
    }
    return {
      end: end,
      success: success,
      shouldSaveFrame: shouldSaveFrame,
      drawOptions: stateOutput.drawOptions,
      helpMessage: stateOutput.helpMessage,
      helpAnimationNumber: stateOutput.helpAnimationNumber
    };
  }

  private changeCurrentState(state: State) {
    if (this.currentState !== state) {
      this.currentState = state;
      this.endTime =
        state.getMaximumDurationInSeconds() !== -1 ? Date.now() / 1000 + state.getMaximumDurationInSeconds() : -1;
    }
  }
}
