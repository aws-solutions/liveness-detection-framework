/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as faceapi from "face-api.js";
import { NoseChallengeParams } from "./NoseChallengeParams";
import { DrawColors, DrawOptions } from "./OverlayCanvasDrawer";
import { ConfigUtils } from "../utils/ConfigUtils";
import { LogUtils } from "../utils/LogUtils";

export interface StateOutput {
  readonly nextState?: State;
  readonly drawOptions?: DrawOptions;
  readonly helpMessage?: string;
  readonly helpAnimationNumber?: number;
}

export abstract class State {
  constructor(readonly noseChallengeParams: NoseChallengeParams) {}

  process(
    faces: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ): StateOutput {
    return {};
  }

  getMaximumDurationInSeconds(): number {
    return -1;
  }

  protected isFaceBoxInsideFaceArea(faceBox: faceapi.Box, addTolerance = true) {
    const tolerance: number = addTolerance ? parseInt(ConfigUtils.getConfig().FACE_AREA_TOLERANCE_PERCENT) / 100 : 0;
    return (
      faceBox.x >= this.noseChallengeParams.areaLeft * (1 - tolerance) &&
      faceBox.y >= this.noseChallengeParams.areaTop * (1 - tolerance) &&
      faceBox.x + faceBox.width <=
        this.noseChallengeParams.areaLeft + this.noseChallengeParams.areaWidth * (1 + tolerance) &&
      faceBox.y + faceBox.height <=
        this.noseChallengeParams.areaTop + this.noseChallengeParams.areaHeight * (1 + tolerance)
    );
  }

  protected isNoseInsideNoseArea(nose: faceapi.IPoint) {
    return (
      nose.x >= this.noseChallengeParams.noseLeft &&
      nose.y >= this.noseChallengeParams.noseTop &&
      nose.x <= this.noseChallengeParams.noseLeft + this.noseChallengeParams.noseWidth &&
      nose.y <= this.noseChallengeParams.noseTop + this.noseChallengeParams.noseHeight
    );
  }

  abstract getName(): string;
}

export class FailState extends State {
  static NAME = "FailState";

  getName(): string {
    return FailState.NAME;
  }
}

export class SuccessState extends State {
  static NAME = "SuccessState";

  getName(): string {
    return SuccessState.NAME;
  }
}

export class NoseState extends State {
  static NAME = "NoseState";

  private framesWithoutFace = 0;
  private landmarkIndex = parseInt(ConfigUtils.getConfig().LANDMARK_INDEX);

  process(
    faces: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ): StateOutput {
    let nextState: State = this;
    if (faces.length === 1) {
      if (this.isFaceBoxInsideFaceArea(faces[0].detection.box)) {
        if (this.isNoseInsideNoseArea(faces[0].landmarks.positions[this.landmarkIndex])) {
          nextState = new SuccessState(this.noseChallengeParams);
        }
      } else {
        LogUtils.info(
          `NoseState fail: isFaceBoxInsideFaceArea=${this.isFaceBoxInsideFaceArea(faces[0].detection.box)}`
        );
        nextState = new FailState(this.noseChallengeParams);
      }
    } else {
      if (
        faces.length !== 0 ||
        ++this.framesWithoutFace > parseInt(ConfigUtils.getConfig().STATE_NOSE_MAX_FRAMES_WITHOUT_FACE)
      ) {
        LogUtils.info(`NoseState fail: #faces=${faces.length} framesWithoutFace=${this.framesWithoutFace}`);
        nextState = new FailState(this.noseChallengeParams);
      } else {
        LogUtils.debug(`no face detected. Skipping frame...`);
      }
    }
    const drawOptions: DrawOptions = {
      faceDrawBoxOptions: {
        boxColor: DrawColors.GREEN,
        boxHeight: this.noseChallengeParams.areaHeight,
        boxLeft: this.noseChallengeParams.areaLeft,
        boxTop: this.noseChallengeParams.areaTop,
        boxWidth: this.noseChallengeParams.areaWidth
      },
      noseDrawBoxOptions: {
        boxColor: DrawColors.YELLOW,
        boxHeight: this.noseChallengeParams.noseHeight,
        boxLeft: this.noseChallengeParams.noseLeft,
        boxTop: this.noseChallengeParams.noseTop,
        boxWidth: this.noseChallengeParams.noseWidth
      }
    };
    return {
      nextState: nextState,
      drawOptions: drawOptions,
      helpMessage: "Slowly move the tip of your nose inside the yellow area",
      helpAnimationNumber: 2
    };
  }

  getMaximumDurationInSeconds(): number {
    return parseInt(ConfigUtils.getConfig().STATE_NOSE_DURATION_IN_SECONDS);
  }

  getName(): string {
    return NoseState.NAME;
  }
}

export class AreaState extends State {
  static NAME = "AreaState";

  private framesWithoutFace = 0;

  process(
    faces: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ): StateOutput {
    let nextState: State = this;
    let boxColor = DrawColors.RED;
    if (faces.length === 1) {
      if (this.isFaceBoxInsideFaceArea(faces[0].detection.box, false)) {
        boxColor = DrawColors.GREEN;
        nextState = new NoseState(this.noseChallengeParams);
      }
    } else {
      if (
        faces.length !== 0 ||
        ++this.framesWithoutFace > parseInt(ConfigUtils.getConfig().STATE_AREA_MAX_FRAMES_WITHOUT_FACE)
      ) {
        LogUtils.info(`AreaState fail: #faces=${faces.length} framesWithoutFace=${this.framesWithoutFace}`);
        nextState = new FailState(this.noseChallengeParams);
      } else {
        LogUtils.debug(`no face detected. Skipping frame...`);
      }
    }
    const drawOptions: DrawOptions = {
      faceDrawBoxOptions: {
        boxColor: boxColor,
        boxHeight: this.noseChallengeParams.areaHeight,
        boxLeft: this.noseChallengeParams.areaLeft,
        boxTop: this.noseChallengeParams.areaTop,
        boxWidth: this.noseChallengeParams.areaWidth
      }
    };
    return {
      nextState: nextState,
      drawOptions: drawOptions,
      helpMessage: "Center your face inside the area",
      helpAnimationNumber: 1
    };
  }

  getMaximumDurationInSeconds(): number {
    return parseInt(ConfigUtils.getConfig().STATE_AREA_DURATION_IN_SECONDS);
  }

  getName(): string {
    return AreaState.NAME;
  }
}

export class FaceState extends State {
  static NAME = "FaceState";

  private numFramesCorrect = 0;

  protected isFaceBoxAreBiggerThanMin(faceBox: faceapi.Box) {
    const totalArea = this.noseChallengeParams.areaWidth * this.noseChallengeParams.areaHeight;
    const faceAreaPercent = (faceBox.area * 100) / totalArea;
    const faceAreaTolerance = parseInt(ConfigUtils.getConfig().FACE_AREA_TOLERANCE_PERCENT);
    const minFaceAreaPercent = parseInt(ConfigUtils.getConfig().MIN_FACE_AREA_PERCENT);
    const isBigger = faceAreaPercent + faceAreaTolerance >= minFaceAreaPercent;
    LogUtils.debug(
      `isFaceBoxAreBiggerThanMin: ${isBigger} Face area: ${faceAreaPercent}% Minimum: ${minFaceAreaPercent -
        faceAreaTolerance}%`
    );
    return isBigger;
  }

  process(
    faces: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ): StateOutput {
    let nextState: State = this;
    let helpMessage = undefined;
    switch (faces.length) {
      case 0:
        this.numFramesCorrect = 0;
        helpMessage = "No face detected. Look at the camera.";
        break;
      case 1:
        if (this.isFaceBoxAreBiggerThanMin(faces[0].detection.box)) {
          this.numFramesCorrect++;
          if (this.numFramesCorrect >= parseInt(ConfigUtils.getConfig().MIN_FRAMES_FACE_STATE)) {
            nextState = new AreaState(this.noseChallengeParams);
          }
        } else {
          helpMessage = "You're too far. Come closer.";
        }
        break;
      default:
        this.numFramesCorrect = 0;
        helpMessage = "More than one face detected. Should be one.";
    }
    const drawOptions: DrawOptions = {
      faceDrawBoxOptions: {
        boxColor: DrawColors.RED,
        boxHeight: this.noseChallengeParams.areaHeight,
        boxLeft: this.noseChallengeParams.areaLeft,
        boxTop: this.noseChallengeParams.areaTop,
        boxWidth: this.noseChallengeParams.areaWidth
      }
    };
    return {
      nextState: nextState,
      drawOptions: drawOptions,
      helpMessage: helpMessage
    };
  }

  getName(): string {
    return FaceState.NAME;
  }
}
