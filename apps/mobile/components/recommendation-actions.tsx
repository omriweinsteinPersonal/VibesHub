import { colors, radii } from '@vibeshub/design-tokens';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const actions = [
  ['item', 'Item'],
  ['brand', 'Brand'],
  ['collection', 'Collection'],
  ['carousel', 'Carousel'],
  ['discount', 'Discount'],
] as const;

export type RecommendationAction = (typeof actions)[number][0];

export function RecommendationActions({
  activeEditor,
  onSelect,
}: {
  activeEditor: RecommendationAction | null;
  onSelect: (action: RecommendationAction) => void;
}) {
  return (
    <View style={styles.actions}>
      {actions.map(([action, label]) => {
        const selected = activeEditor === action;
        return (
          <Pressable
            key={action}
            accessibilityLabel={`Add ${label.toLowerCase()}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: selected, selected }}
            onPress={() => onSelect(action)}
            style={[styles.button, selected ? styles.selected : styles.idle]}
          >
            <Text
              style={[styles.label, selected ? styles.selectedLabel : styles.idleLabel]}
            >
              {selected ? '✓' : '+'} {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    alignItems: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  idle: { backgroundColor: 'transparent', borderColor: colors.accent },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontWeight: '700' },
  idleLabel: { color: colors.accent },
  selectedLabel: { color: colors.white },
});
