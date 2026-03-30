// Package auth will hold Google SSO integration.
// Currently a no-op stub — authentication is not required to play.
package auth

import "net/http"

// UserID returns the authenticated user's ID from the request, or empty string
// if unauthenticated. When Google SSO is implemented, this will validate the
// session cookie/JWT and return the user's Google sub claim.
func UserID(r *http.Request) string {
	return ""
}

// IsAuthenticated reports whether the request carries a valid session.
func IsAuthenticated(r *http.Request) bool {
	return UserID(r) != ""
}
