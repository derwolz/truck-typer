package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"
	"typist/internal/words"
)

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------------------
// Cookie-based anonymous user ID
// ---------------------------------------------------------------------------

const userIDCookie = "typist_uid"

func getOrCreateUserID(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(userIDCookie); err == nil && c.Value != "" {
		return c.Value
	}
	id := fmt.Sprintf("%016x%016x", rand.Int63(), rand.Int63())
	http.SetCookie(w, &http.Cookie{
		Name:     userIDCookie,
		Value:    id,
		MaxAge:   365 * 24 * 3600,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return id
}

// ---------------------------------------------------------------------------
// In-memory leaderboard — one ranked list per mode (resets on server restart)
// ---------------------------------------------------------------------------

type LeaderEntry struct {
	WPM      int    `json:"wpm"`
	Accuracy int    `json:"accuracy"`
	At       int64  `json:"at"` // Unix ms
	Name     string `json:"name,omitempty"`
}

// boards maps mode → sorted leaderboard slice
var (
	lbMu   sync.Mutex
	boards = map[string][]LeaderEntry{
		"words":     {},
		"sentences": {},
	}
)

const maxLeaderboard = 20

func insertLeaderboard(mode string, entry LeaderEntry) (rank int, snapshot []LeaderEntry) {
	if mode != "sentences" {
		mode = "words"
	}
	lbMu.Lock()
	defer lbMu.Unlock()
	lb := append(boards[mode], entry)
	sort.Slice(lb, func(i, j int) bool { return lb[i].WPM > lb[j].WPM })
	if len(lb) > maxLeaderboard {
		lb = lb[:maxLeaderboard]
	}
	boards[mode] = lb
	for i, e := range lb {
		if e.At == entry.At && e.WPM == entry.WPM {
			rank = i + 1
			break
		}
	}
	snapshot = make([]LeaderEntry, len(lb))
	copy(snapshot, lb)
	return
}

func getBoard(mode string) []LeaderEntry {
	if mode != "sentences" {
		mode = "words"
	}
	lbMu.Lock()
	defer lbMu.Unlock()
	snap := make([]LeaderEntry, len(boards[mode]))
	copy(snap, boards[mode])
	return snap
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func Words(w http.ResponseWriter, r *http.Request) {
	count := 200
	if n, err := strconv.Atoi(r.URL.Query().Get("count")); err == nil && n > 0 && n <= 500 {
		count = n
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"words": words.Random(count)})
}

func Sentences(w http.ResponseWriter, r *http.Request) {
	count := 50
	if n, err := strconv.Atoi(r.URL.Query().Get("count")); err == nil && n > 0 && n <= 200 {
		count = n
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"words": words.RandomSentences(count)})
}

func GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"mode":        mode,
		"leaderboard": getBoard(mode),
	})
}

type scorePayload struct {
	WPM      int    `json:"wpm"`
	Accuracy int    `json:"accuracy"`
	Mode     string `json:"mode"`
	Name     string `json:"name"`
}

func PostScore(w http.ResponseWriter, r *http.Request) {
	getOrCreateUserID(w, r) // ensure cookie is always set

	var p scorePayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil || p.WPM <= 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	mode := p.Mode
	if mode == "" {
		mode = "words"
	}

	// Sanitize display name: printable ASCII, max 16 chars
	name := ""
	for _, c := range p.Name {
		if c >= 0x20 && c < 0x7f {
			name += string(c)
		}
		if len(name) >= 16 {
			break
		}
	}

	entry := LeaderEntry{
		WPM:      p.WPM,
		Accuracy: p.Accuracy,
		At:       time.Now().UnixMilli(),
		Name:     name,
	}

	rank, snap := insertLeaderboard(mode, entry)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"rank":        rank,
		"leaderboard": snap,
	})
}
