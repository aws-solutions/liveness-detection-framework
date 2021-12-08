/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as faceapi from "face-api.js";

export class DrawColors {
  public static readonly RED = "rgba(255, 71, 71)";
  public static readonly GREEN = "rgba(29, 82, 64, 1)";
  public static readonly YELLOW = "rgba(229, 167, 9, 1)";
}

export interface DrawBoxOptions {
  readonly boxHeight: number;
  readonly boxLeft: number;
  readonly boxTop: number;
  readonly boxWidth: number;
  readonly boxColor?: string;
  readonly lineWidth?: number;
}

export interface DrawOptions {
  readonly faceDrawBoxOptions?: DrawBoxOptions;
  readonly noseDrawBoxOptions?: DrawBoxOptions;
}

export class OverlayCanvasDrawer {
  private readonly overlayCanvasElement: HTMLCanvasElement;

  constructor(overlayCanvasElement: HTMLCanvasElement) {
    this.overlayCanvasElement = overlayCanvasElement;
  }

  draw(drawOptions: DrawOptions) {
    if (drawOptions.faceDrawBoxOptions) {
      this.drawArea(drawOptions.faceDrawBoxOptions);
    }
    if (drawOptions.noseDrawBoxOptions) {
      this.drawArea(drawOptions.noseDrawBoxOptions);
    }
  }

  private drawArea(drawBoxOptions: DrawBoxOptions) {
    const box = {
      x: drawBoxOptions.boxLeft,
      y: drawBoxOptions.boxTop,
      width: drawBoxOptions.boxWidth,
      height: drawBoxOptions.boxHeight
    };
    const drawBox = new faceapi.draw.DrawBox(box, drawBoxOptions);
    drawBox.draw(this.overlayCanvasElement);
  }
}
