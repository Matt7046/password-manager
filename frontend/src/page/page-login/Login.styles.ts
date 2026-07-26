import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: 24,
    ...(Platform.OS === 'web'
      ? {
          backgroundColor: '#16213e',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#0f3460',
          marginVertical: 32,
        }
      : {}),
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 16,
  },
  biometricText: {
    color: '#4ecdc4',
    fontSize: 16,
    marginLeft: 8,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  forgotText: {
    color: '#4ecdc4',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#0f3460',
  },
  dividerText: {
    color: '#666',
    fontSize: 13,
    marginHorizontal: 12,
  },
  createAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#4ecdc4',
    gap: 8,
  },
  createAccountText: {
    color: '#4ecdc4',
    fontSize: 16,
    fontWeight: '600',
  },
});
