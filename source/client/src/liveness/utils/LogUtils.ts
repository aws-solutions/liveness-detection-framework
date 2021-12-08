/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "aws-amplify";

const LOGGER_NAME = "LivenessDetection";

let LOG_LEVEL = "DEBUG";
if (process.env.NODE_ENV === "production") {
  LOG_LEVEL = "ERROR";
}

export class LogUtils {
  private static logger = new Logger(LOGGER_NAME, LOG_LEVEL);

  public static debug(...msg: any[]): void {
    LogUtils.logger.debug(...msg);
  }

  public static info(...msg: any[]): void {
    LogUtils.logger.info(...msg);
  }

  public static warn(...msg: any[]): void {
    LogUtils.logger.warn(...msg);
  }

  public static error(...msg: any[]): void {
    LogUtils.logger.error(...msg);
  }
}
