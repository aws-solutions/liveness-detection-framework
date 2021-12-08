/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigUtils } from "./ConfigUtils";
import { LogUtils } from "./LogUtils";

export interface MediaStreamInfo {
  mediaStream: MediaStream;
  actualHeight: number;
  actualWidth: number;
}

export class MediaUtils {
  static loadMediaStream(successCallback: () => void, errorCallback: (message: string) => void) {
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: {
          ideal: window.innerWidth,
          max: parseInt(ConfigUtils.getConfig().MAX_IMAGE_WIDTH)
        },
        height: {
          ideal: window.innerWidth,
          max: parseInt(ConfigUtils.getConfig().MAX_IMAGE_HEIGHT)
        },
        facingMode: "user",
        aspectRatio: 1.0
      }
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((mediaStream: MediaStream) => {
        try {
          const mediaStreamInfo = {
            mediaStream: mediaStream,
            actualHeight: mediaStream.getVideoTracks()[0].getSettings().height,
            actualWidth: mediaStream.getVideoTracks()[0].getSettings().width
          };
          LogUtils.info(
            `media info: actualHeight=${mediaStreamInfo.actualHeight} actualWidth=${mediaStreamInfo.actualWidth}`
          );
          (window as any).mediaStreamInfo = mediaStreamInfo;
        } catch (error) {
          LogUtils.error(error);
          errorCallback("Error getting video actual sizes");
        }
        successCallback();
      })
      .catch(error => {
        LogUtils.error(error);
        errorCallback("Error getting access to the camera");
      });
  }

  static getMediaStreamInfo(): MediaStreamInfo {
    return (window as any).mediaStreamInfo as MediaStreamInfo;
  }
}
