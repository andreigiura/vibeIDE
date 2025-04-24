import { atom } from 'nanostores';

/*
 * Define a type for the user data
 * In a real app, this would likely be more detailed
 */
interface UserProfile {
  user: string;

  // Add other relevant fields like email, name, roles etc. later
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialCheckComplete: boolean;
  user: UserProfile | null; // New field for user data
}

const initialAuthState: AuthState = {
  isAuthenticated: false, // Start as not authenticated
  isLoading: false, // Start isLoading false until check begins
  error: null,
  initialCheckComplete: false, // Start as false
  user: null, // Initialize user as null
};

// Atom to hold the authentication state
export const authStore = atom<AuthState>(initialAuthState);

// Helper function to update the auth state
export function setAuthState(newState: Partial<AuthState>) {
  /*
   * Prevent setting isLoading to true if initial check is already complete and successful
   * This avoids brief loading flickers on subsequent state updates after login
   */
  const currentState = authStore.get();

  if (newState.isLoading && currentState.initialCheckComplete && currentState.isAuthenticated) {
    delete newState.isLoading;
  }

  authStore.set({ ...currentState, ...newState });
}

// Helper function to reset auth state (e.g., on logout)
export function resetAuthState() {
  // Resetting should also reset the user and check complete flag
  authStore.set({ ...initialAuthState, user: null, initialCheckComplete: false });
}
