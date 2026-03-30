package words

import (
	"math/rand"
)

var sentencePool = []string{
	"The quick brown fox jumps over the lazy dog near the old river.",
	"Pack my box with five dozen liquor jugs before the ship sets sail.",
	"How vexingly quick daft zebras jump across the wide open plain.",
	"The five boxing wizards jump quickly and land perfectly on their feet.",
	"Sphinx of black quartz, judge my vow and make it forever binding.",
	"A journey of a thousand miles begins with a single courageous step.",
	"The early bird catches the worm but loses precious sleep in the process.",
	"In the middle of every difficulty lies an opportunity waiting to be seized.",
	"It was the best of times, it was the worst of times, and everything between.",
	"All happy families are alike, but every unhappy family suffers in its own way.",
	"Call me Ishmael, for that is the name my mother gave me long ago.",
	"To be or not to be, that is the question every thoughtful person must face.",
	"Ask not what your country can do for you, but what you can do for it.",
	"We hold these truths to be self-evident, that all people are created equal.",
	"Four score and seven years ago, our fathers brought forth a brand new nation.",
	"One small step for man, one giant leap for all of humankind forever forward.",
	"Float like a butterfly, sting like a bee, and always keep moving forward.",
	"Life is what happens when you are busy making other plans for your future.",
	"The future belongs to those who believe in the beauty of their own dreams.",
	"You miss every single shot that you never summon the courage to take.",
	"Whether you think you can or you cannot, you are absolutely right either way.",
	"The only thing we have to fear is fear itself and all its many disguises.",
	"Give me liberty or give me death, for there is no acceptable middle ground here.",
	"Stay hungry, stay foolish, and never stop learning something entirely new each day.",
	"In the end, it is not the years in your life that truly matter most.",
	"The greatest glory lies not in never falling, but in rising every single time.",
	"Success is not final, failure is not fatal, but the courage to continue always counts.",
	"It always seems impossible until someone finally does it and looks back with pride.",
	"The only way to do great work is to genuinely love what you do daily.",
	"Innovation distinguishes between a true leader and a mere follower in every field.",
	"Two roads diverged in a yellow wood, and I took the one less traveled by.",
	"Do not go gentle into that good night, but rage against the dying of light.",
	"Hope is the thing with feathers that perches in the soul and sings without words.",
	"Because I could not stop for death, it kindly stopped to wait patiently for me.",
	"I have measured out my life with coffee spoons and quiet Sunday afternoons alone.",
	"The woods are lovely, dark and deep, but I have promises I must still keep.",
	"We shall fight on the beaches, in the fields, and in the streets without surrender.",
	"That is one small step for a man, but one giant leap for all mankind.",
	"The secret of getting ahead is getting started when you have the chance to begin.",
	"Either write something worth reading or do something truly worth writing about today.",
	"Well-behaved women seldom make history, so stop behaving and start making your mark.",
	"In order to be irreplaceable, one must always be different from everyone else around.",
	"I have not failed, I have just found ten thousand ways that simply will not work.",
	"Imagination is more important than knowledge, for knowledge is limited but imagination is not.",
	"Strive not to be a success, but rather to be a person of lasting real value.",
	"A person who never made a mistake never tried anything new or remotely interesting.",
	"Logic will get you from point A to point B, but imagination takes you everywhere.",
	"The important thing is not to stop questioning, for curiosity has its own reason to exist.",
	"Anyone who has never made a mistake has never truly tried anything worth attempting.",
	"Try not to become a person of success, but rather a person of genuine value.",
}

// RandomSentences returns n random sentences from the pool.
func RandomSentences(n int) []string {
	result := make([]string, n)
	for i := range result {
		result[i] = sentencePool[rand.Intn(len(sentencePool))]
	}
	return result
}
