import * as React from 'react';

import { StudyTimerModuleViewProps } from './StudyTimerModule.types';

export default function StudyTimerModuleView(props: StudyTimerModuleViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
