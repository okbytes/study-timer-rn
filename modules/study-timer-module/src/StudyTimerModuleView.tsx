import { requireNativeView } from 'expo';
import * as React from 'react';

import { StudyTimerModuleViewProps } from './StudyTimerModule.types';

const NativeView: React.ComponentType<StudyTimerModuleViewProps> =
  requireNativeView('StudyTimerModule');

export default function StudyTimerModuleView(props: StudyTimerModuleViewProps) {
  return <NativeView {...props} />;
}
