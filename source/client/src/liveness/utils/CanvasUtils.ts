/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export class CanvasUtils {
  private static getVideoElement(elementId: string): HTMLVideoElement {
    const videoElement = document.getElementById(elementId) as HTMLVideoElement;
    if (!videoElement) {
      throw Error(`Video element ${elementId} not found`);
    }
    return videoElement;
  }

  public static getCanvasElement(elementId: string): HTMLCanvasElement {
    const canvasElement = document.getElementById(elementId) as HTMLCanvasElement;
    if (!canvasElement) {
      throw Error(`Canvas element ${elementId} not found`);
    }
    return canvasElement;
  }

  public static getCanvasContext(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (context === null) {
      throw Error("Error getting canvas context");
    }
    return context;
  }

  public static setVideoElementSrc(videoElementId: string, mediaStream: MediaStream) {
    const videoElement = CanvasUtils.getVideoElement(videoElementId);
    videoElement.srcObject = mediaStream;
  }

  public static takePhoto(
    videoElementId: string,
    canvasElementId: string,
    width: number,
    height: number,
    flip: boolean
  ) {
    const videoElement = CanvasUtils.getVideoElement(videoElementId);
    const canvasElement = CanvasUtils.getCanvasElement(canvasElementId);
    const canvasContext = CanvasUtils.getCanvasContext(canvasElement);
    canvasElement.width = width;
    canvasElement.height = height;
    if (flip) {
      canvasContext.scale(-1, 1);
      canvasContext.drawImage(videoElement, 0, 0, width * -1, height);
    } else {
      canvasContext.drawImage(videoElement, 0, 0);
    }
  }

  public static getPhotoFromCanvas(canvasElementId: string, jpgQuality: string) {
    const canvasElement = CanvasUtils.getCanvasElement(canvasElementId);
    const image = canvasElement.toDataURL("image/jpeg", jpgQuality);
    return image.substr(image.indexOf(",") + 1);
  }

  public static getScaleFactor(canvasElement: HTMLCanvasElement, image: HTMLImageElement | HTMLCanvasElement) {
    const widthScaleFactor = canvasElement.width / image.width;
    const heightScaleFactor = canvasElement.height / image.height;
    return Math.min(widthScaleFactor, heightScaleFactor);
  }

  public static drawImageInCanvas(
    canvasElementId: string,
    image: HTMLImageElement | HTMLCanvasElement,
    dx: number,
    dy: number,
    scaleFactor: number
  ) {
    const canvasElement = CanvasUtils.getCanvasElement(canvasElementId);
    const canvasContext = CanvasUtils.getCanvasContext(canvasElement);
    canvasContext.drawImage(image, dx, dy, image.width * scaleFactor, image.height * scaleFactor);
  }

  public static drawScaledCanvasInCanvas(sourceCanvasElementId: string, destinationCanvasElementId: string) {
    CanvasUtils.drawImageInCanvas(
      destinationCanvasElementId,
      CanvasUtils.getCanvasElement(sourceCanvasElementId),
      0,
      0,
      CanvasUtils.getScaleFactor(
        CanvasUtils.getCanvasElement(destinationCanvasElementId),
        CanvasUtils.getCanvasElement(sourceCanvasElementId)
      )
    );
  }
}
