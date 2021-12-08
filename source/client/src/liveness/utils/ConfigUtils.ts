/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Config {
  DRAW_DETECTIONS: string;
  API_NAME: string;
  API_URL: string;
  API_START_ENDPOINT: string;
  API_VERIFY_ENDPOINT_PATTERN: string;
  API_FRAMES_ENDPOINT_PATTERN: string;
  MAX_IMAGE_WIDTH: string;
  MAX_IMAGE_HEIGHT: string;
  IMAGE_JPG_QUALITY: string;
  STATE_AREA_DURATION_IN_SECONDS: string;
  STATE_NOSE_DURATION_IN_SECONDS: string;
  STATE_AREA_MAX_FRAMES_WITHOUT_FACE: string;
  STATE_NOSE_MAX_FRAMES_WITHOUT_FACE: string;
  MAX_FPS: string;
  FACE_AREA_TOLERANCE_PERCENT: string;
  MIN_FACE_AREA_PERCENT: string;
  FLIP_VIDEO: string;
  LANDMARK_INDEX: string;
  MIN_FRAMES_FACE_STATE: string;
}

export class ConfigUtils {
  private static KEY_PREFIX = "REACT_APP_";

  static loadConfig() {
    const envKeys = Object.keys(process.env);
    const map = new Map();
    envKeys.forEach(envKey => {
      const key = envKey.replace(ConfigUtils.KEY_PREFIX, "");
      const value = process.env[envKey] as string;
      map.set(key, value);
    });
    (window as any).config = Object.fromEntries(map);
  }

  static getConfig(): Config {
    return (window as any).config as Config;
  }

  static getConfigBooleanValue(configKey: string): boolean {
    return (
      new Map(Object.entries(ConfigUtils.getConfig()))
        .get(configKey)
        .trim()
        .toLowerCase() === "true"
    );
  }
}

ConfigUtils.loadConfig();
