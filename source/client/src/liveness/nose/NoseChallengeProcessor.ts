/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as faceapi from "face-api.js";
import { NoseChallengeParams } from "./NoseChallengeParams";
import { OverlayCanvasDrawer } from "./OverlayCanvasDrawer";
import { StateManager, StateManagerOutput } from "./StateManager";
import { APIUtils, ChallengeMetadata } from "../utils/APIUtils";
import { ConfigUtils } from "../utils/ConfigUtils";
import { MediaUtils } from "../utils/MediaUtils";
import { LogUtils } from "../utils/LogUtils";

export class NoseChallengeProcessor {
  private readonly challengeId: string;
  private readonly challengeToken: string;
  private readonly localEndCallback: (success: boolean) => void;
  private readonly uploadEndCallback: () => void;
  private readonly helpMessageCallback: (helpMessage: string | undefined) => void;
  private readonly helpAnimationCallback: (helpAnimationNumber: number | undefined) => void;
  private readonly overlayCanvasDrawer: OverlayCanvasDrawer;
  private readonly stateManager: StateManager;
  private readonly cameraVideoElement: HTMLVideoElement;
  private readonly overlayCanvasElement: HTMLCanvasElement;
  private readonly invisibleCanvasElement: HTMLCanvasElement;

  private lastHelpMessage: string | undefined;
  private lastHelpAnimationNumber: number | undefined;
  private uploadPromises: Promise<void>[];

  private static modelPromises: Promise<void>[] = [];

  constructor(
    challengeMetadata: ChallengeMetadata,
    cameraVideoElementId: string,
    overlayCanvasElementId: string,
    localEndCallback: (localSuccess: boolean) => void,
    uploadEndCallback: () => void,
    helpMessageCallback: (helpMessage: string | undefined) => void,
    helpAnimationCallback: (helpAnimationNumber: number | undefined) => void
  ) {
    this.challengeId = challengeMetadata.id;
    this.challengeToken = challengeMetadata.token;
    this.localEndCallback = localEndCallback;
    this.uploadEndCallback = uploadEndCallback;
    this.helpMessageCallback = helpMessageCallback;
    this.helpAnimationCallback = helpAnimationCallback;
    this.stateManager = new StateManager(challengeMetadata.params as NoseChallengeParams);
    this.cameraVideoElement = document.getElementById(cameraVideoElementId) as HTMLVideoElement;
    if (!this.cameraVideoElement) {
      throw Error("Camera video element not found");
    }
    this.cameraVideoElement.srcObject = MediaUtils.getMediaStreamInfo().mediaStream;

    this.overlayCanvasElement = document.getElementById(overlayCanvasElementId) as HTMLCanvasElement;
    if (!this.overlayCanvasElement) {
      throw Error("Overlay canvas element not found");
    }
    this.overlayCanvasDrawer = new OverlayCanvasDrawer(this.overlayCanvasElement);

    this.invisibleCanvasElement = document.createElement("canvas");

    this.uploadPromises = [];
  }

  static loadModels(): Promise<void[]> {
    if (NoseChallengeProcessor.modelPromises.length === 0) {
      const url = "/weights/";
      NoseChallengeProcessor.modelPromises.push(this.loadFaceDetectionModel(url));
      NoseChallengeProcessor.modelPromises.push(this.loadLandmarkModel(url));
    }
    return Promise.all(NoseChallengeProcessor.modelPromises);
  }

  private static loadFaceDetectionModel(url: string): Promise<void> {
    const promise = faceapi.nets.tinyFaceDetector.load(url);
    promise.then(() => {
      LogUtils.info("tinyFaceDetector model loaded");
    });
    return promise;
  }

  private static loadLandmarkModel(url: string): Promise<void> {
    const promise = faceapi.nets.faceLandmark68Net.load(url);
    promise.then(() => {
      LogUtils.info("faceLandmark68Net model loaded");
    });
    return promise;
  }

  public start() {
    this.cameraVideoElement.addEventListener("loadedmetadata", () => {
      this.process();
    });
  }

  private process(): any {
    LogUtils.debug("video event handler");
    if (this.cameraVideoElement.paused || this.cameraVideoElement.ended) {
      LogUtils.debug("video paused or ended");
      return setTimeout(() => this.process(), 10);
    }
    const options = new faceapi.TinyFaceDetectorOptions();
    faceapi
      .detectAllFaces(this.cameraVideoElement, options)
      .withFaceLandmarks(false)
      .then((result: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]) => {
        if (result) {
          this.processDetectionResults(result);
        } else {
          setTimeout(() => this.process());
        }
        return result;
      });
  }

  private processDetectionResults(
    results: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ) {
    const dims = faceapi.matchDimensions(this.overlayCanvasElement, this.cameraVideoElement);
    const resizedResults = faceapi.resizeResults(results, dims);
    const stateManagerOutput: StateManagerOutput = this.stateManager.process(results);

    if (ConfigUtils.getConfigBooleanValue("DRAW_DETECTIONS")) {
      faceapi.draw.drawDetections(this.overlayCanvasElement, resizedResults);
      faceapi.draw.drawFaceLandmarks(this.overlayCanvasElement, resizedResults);
    }

    if (stateManagerOutput.drawOptions) {
      this.overlayCanvasDrawer.draw(stateManagerOutput.drawOptions);
    }

    if (stateManagerOutput.helpMessage !== this.lastHelpMessage) {
      LogUtils.debug(`help message change: from='${this.lastHelpMessage}' to='${stateManagerOutput.helpMessage}'`);
      this.helpMessageCallback(stateManagerOutput.helpMessage);
    }
    this.lastHelpMessage = stateManagerOutput.helpMessage;

    if (stateManagerOutput.helpAnimationNumber !== this.lastHelpAnimationNumber) {
      LogUtils.debug(
        `help animation change: from=${this.lastHelpAnimationNumber} to=${stateManagerOutput.helpAnimationNumber}`
      );
      this.helpAnimationCallback(stateManagerOutput.helpAnimationNumber);
    }
    this.lastHelpAnimationNumber = stateManagerOutput.helpAnimationNumber;

    if (stateManagerOutput.shouldSaveFrame) {
      LogUtils.debug("should save frame");
      this.uploadPromises.push(this.uploadFrame());
    }

    // if challenge completed locally
    if (stateManagerOutput.end) {
      const localSuccess = stateManagerOutput.success as boolean;
      LogUtils.info("local challenge result: %s", localSuccess);
      this.localEndCallback(localSuccess);
      Promise.all(this.uploadPromises).then(() => {
        this.uploadEndCallback();
      });
    }
    // if not completed, schedule next frame capture
    else {
      const delay = 1000 / parseInt(ConfigUtils.getConfig().MAX_FPS);
      setTimeout(() => this.process(), delay);
    }
  }

  private uploadFrame(): Promise<void> {
    const invisibleCanvasContext = this.invisibleCanvasElement.getContext("2d");
    if (invisibleCanvasContext === null) {
      throw Error("Error getting invisible canvas context");
    }
    this.invisibleCanvasElement.width = this.cameraVideoElement.videoWidth;
    this.invisibleCanvasElement.height = this.cameraVideoElement.videoHeight;
    invisibleCanvasContext.drawImage(
      this.cameraVideoElement,
      0,
      0,
      this.cameraVideoElement.videoWidth,
      this.cameraVideoElement.videoHeight
    );

    if (ConfigUtils.getConfigBooleanValue("FLIP_VIDEO")) {
      invisibleCanvasContext.scale(-1, 1);
    }

    const canvas = this.invisibleCanvasElement;
    return new Promise((resolve: () => void, reject: (reason: any) => void) => {
      const image = canvas.toDataURL("image/jpeg", ConfigUtils.getConfig().IMAGE_JPG_QUALITY);
      APIUtils.putChallengeFrame(
        this.challengeId,
        this.challengeToken,
        image.substr(image.indexOf(",") + 1),
        Date.now()
      )
        .then(resolve)
        .catch(reject);
    });
  }
}
