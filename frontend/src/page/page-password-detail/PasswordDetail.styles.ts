import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  scrollContentWide: {
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  accountName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 24,
    width: '100%',
  },
  detailCardWide: {
    maxWidth: 720,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  credentialBlock: {
    paddingVertical: 12,
    gap: 10,
  },
  detailColumn: {
    paddingVertical: 12,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelText: {
    color: '#999',
    fontSize: 14,
  },
  credentialValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  valueText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#0f3460',
  },
  categoryBadge: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  tag: {
    color: '#4ecdc4',
    fontSize: 14,
  },
  notesText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    lineHeight: 24,
  },
  metadata: {
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    color: '#666',
    fontSize: 12,
  },
});
