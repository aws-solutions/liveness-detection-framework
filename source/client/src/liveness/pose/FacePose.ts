/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import imgFace from "./imgs/face.png";
import imgMouthClosed from "./imgs/mouth/closed.png";
import imgMouthSmile from "./imgs/mouth/smile.png";
import imgEyeLeftClosed from "./imgs/eye/left_closed.png";
import imgEyeLeftNormal from "./imgs/eye/left_normal.png";
import imgEyeLeftLookingLeft from "./imgs/eye/left_look_left.png";
import imgEyeLeftLookingRight from "./imgs/eye/left_look_right.png";
import imgEyeRightClosed from "./imgs/eye/right_closed.png";
import imgEyeRightNormal from "./imgs/eye/right_normal.png";
import imgEyeRightLookingLeft from "./imgs/eye/right_look_left.png";
import imgEyeRightLookingRight from "./imgs/eye/right_look_right.png";
import { CanvasUtils } from "../utils/CanvasUtils";

const LEFT_EYE_X = 140;
const RIGHT_EYE_X = 354;
const EYE_Y = 290;
const MOUTH_X = 244;
const MOUTH_Y = 556;

type ImgSrcMap = Record<string, string>;
const EYE_LEFT_IMG_SRC_MAP: ImgSrcMap = {
  OPEN: imgEyeLeftNormal,
  CLOSED: imgEyeLeftClosed,
  LOOKING_LEFT: imgEyeLeftLookingLeft,
  LOOKING_RIGHT: imgEyeLeftLookingRight
};
const EYE_RIGHT_IMG_SRC_MAP: ImgSrcMap = {
  OPEN: imgEyeRightNormal,
  CLOSED: imgEyeRightClosed,
  LOOKING_LEFT: imgEyeRightLookingLeft,
  LOOKING_RIGHT: imgEyeRightLookingRight
};
const MOUTH_IMG_SRC_MAP: ImgSrcMap = {
  CLOSED: imgMouthClosed,
  SMILE: imgMouthSmile
};

export class FacePose {
  private readonly eyes: string;
  private readonly mouth: string;

  constructor(eyes: string, mouth: string) {
    this.eyes = eyes;
    this.mouth = mouth;
  }

  public draw(canvasElementId: string) {
    const mouthImageSrc = MOUTH_IMG_SRC_MAP[this.mouth];
    const eyeLeftImageSrc = EYE_LEFT_IMG_SRC_MAP[this.eyes];
    const eyeRightImageSrc = EYE_RIGHT_IMG_SRC_MAP[this.eyes];
    const faceImage = new Image();
    faceImage.src = imgFace;
    faceImage.onload = function() {
      const canvasElement = CanvasUtils.getCanvasElement(canvasElementId);
      const scaleFactor = CanvasUtils.getScaleFactor(canvasElement, faceImage);
      const marginX = (canvasElement.width - faceImage.width * scaleFactor) / 2;
      const marginY = (canvasElement.height - faceImage.height * scaleFactor) / 2;
      CanvasUtils.drawImageInCanvas(canvasElementId, faceImage, marginX, marginY, scaleFactor);
      FacePose.drawImage(
        canvasElementId,
        mouthImageSrc,
        MOUTH_X * scaleFactor + marginX,
        MOUTH_Y * scaleFactor + marginY,
        scaleFactor
      );
      FacePose.drawImage(
        canvasElementId,
        eyeLeftImageSrc,
        LEFT_EYE_X * scaleFactor + marginX,
        EYE_Y * scaleFactor + marginY,
        scaleFactor
      );
      FacePose.drawImage(
        canvasElementId,
        eyeRightImageSrc,
        RIGHT_EYE_X * scaleFactor + marginX,
        EYE_Y * scaleFactor + marginY,
        scaleFactor
      );
    };
  }

  private static drawImage(canvasElementId: string, imageSrc: string, dx: number, dy: number, scaleFactor: number) {
    const image = new Image();
    image.src = imageSrc;
    image.onload = function() {
      CanvasUtils.drawImageInCanvas(canvasElementId, image, dx, dy, scaleFactor);
    };
  }
}
