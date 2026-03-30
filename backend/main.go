package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"typist/internal/handlers"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/words", handlers.Words)
	mux.HandleFunc("/api/sentences", handlers.Sentences)
	mux.HandleFunc("/api/scores", handlers.PostScore)
	mux.HandleFunc("/api/leaderboard", handlers.GetLeaderboard)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	fmt.Printf("typist backend listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handlers.CORS(mux)))
}
