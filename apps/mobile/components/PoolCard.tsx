import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { useTheme } from "../theme/useTheme";
import { PoolCardSkeleton } from "./skeletons/PoolCardSkeleton";

interface PoolCardProps {
  id: string;
  name: string;
  description: string;
  totalValue: string;
  participants: number;
  apy?: string;
  isLoading?: boolean;
  onPress?: () => void;
}

export const PoolCard: React.FC<PoolCardProps> = ({
  id,
  name,
  description,
  totalValue,
  participants,
  apy,
  isLoading = false,
  onPress,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading) {
    return <PoolCardSkeleton />;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      testID={`pool-card-${id}`}
      accessibilityRole="button"
      accessibilityLabel={`Pool ${name} with balance ${totalValue}`}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        {apy && <Text style={styles.apy}>{apy} APY</Text>}
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Value</Text>
          <Text style={styles.statValue}>{totalValue}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Admins</Text>
          <Text style={styles.statValue}>{participants}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadingContainer: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    flex: 1,
  },
  apy: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    backgroundColor: '#1e4c2b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  description: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  loadingBar: {
    backgroundColor: '#334155',
    borderRadius: 4,
    marginBottom: 12,
  },
  nameLoading: {
    height: 18,
    width: '60%',
  },
  descriptionLoading: {
    height: 14,
    width: '100%',
  },
  statLoading: {
    height: 16,
    width: '80%',
  },
});
