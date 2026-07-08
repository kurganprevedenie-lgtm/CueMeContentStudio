import React from "react";
import { Composition } from "remotion";
import { themes } from "@cueme/shared";

import { ChatVideo } from "./ChatVideo";
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  totalDurationInFrames,
  type ChatVideoProps,
} from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ChatVideo"
      component={ChatVideo}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      durationInFrames={VIDEO_FPS * 5}
      defaultProps={
        {
          messages: [],
          theme: themes["imessage-light"],
          timings: [],
          suggestion: null,
          suggestionTiming: null,
          background: null,
        } satisfies ChatVideoProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: totalDurationInFrames(
          props.timings,
          props.suggestionTiming
        ),
      })}
    />
  );
};
