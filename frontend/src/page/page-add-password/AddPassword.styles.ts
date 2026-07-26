import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  textAreaContainer: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 12,
  },
  categoryButtonText: {
    flex: 1,
    color: '#4ecdc4',
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#0f3460',
  },
  categoryOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  categoryOptionTextSelected: {
    color: '#4ecdc4',
    fontWeight: 'bold',
  },
});
