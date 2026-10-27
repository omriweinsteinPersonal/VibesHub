import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  RecommendationActions,
  type RecommendationAction,
} from './recommendation-actions';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));

type ActionButton = ReactElement<{
  accessibilityLabel: string;
  accessibilityState: { selected: boolean; expanded: boolean };
  onPress: () => void;
  style: { backgroundColor?: string }[];
  children: ReactElement<{ children: string[] }>;
}>;

function buttons(
  activeEditor: RecommendationAction | null,
  onSelect: (action: RecommendationAction) => void = vi.fn(),
) {
  return RecommendationActions({ activeEditor, onSelect }).props
    .children as ActionButton[];
}

describe('recommendation action selection (shared iOS and Android UI)', () => {
  it('starts with every action neutral, including Item', () => {
    for (const { props } of buttons(null)) {
      expect(props.accessibilityState).toEqual({ selected: false, expanded: false });
      expect(props.style[1].backgroundColor).toBe('transparent');
      expect(props.children.props.children[0]).toBe('+');
    }
  });

  it('moves the visual and accessible selection through all five actions', () => {
    let activeEditor: RecommendationAction | null = null;
    const select = (action: RecommendationAction) => {
      activeEditor = action;
    };
    for (let index = 0; index < 5; index++) {
      const action = buttons(activeEditor, select)[index];
      action.props.onPress();
      const rendered = buttons(activeEditor, select);
      expect(
        rendered.filter(({ props }) => props.accessibilityState.selected),
      ).toHaveLength(1);
      rendered.forEach(({ props }, buttonIndex) => {
        const selected = buttonIndex === index;
        expect(props.accessibilityState).toEqual({ selected, expanded: selected });
        expect(props.style[1].backgroundColor === 'transparent').toBe(!selected);
        expect(props.children.props.children[0]).toBe(selected ? '✓' : '+');
      });
      expect(rendered[index].props.accessibilityLabel).toBe(
        action.props.accessibilityLabel,
      );
    }
    expect(buttons(null).every(({ props }) => !props.accessibilityState.selected)).toBe(
      true,
    );
  });
});
