package main

import (
	// "fmt"
	"log"
	"net/http"
	"regexp"
	"io/ioutil"
	"os"
	"encoding/json"
	"strconv"
)

var validPath = regexp.MustCompile("^/api/monsters/(\\d{0,3})$")
var result []Monster
var maxNum int

func main() {
	// Abandoned: 
	// Heroku does not seem to let one crate new files during release phase.
	//
	// cmd := exec.Command("node", "crawler/index.js")
	// log.Println("Calling node ...")
	// execErr := cmd.Run()
	// if execErr != nil {
	// 	log.Fatalf("node crawler/index.js failed with: %s\n", execErr)
	// }
	// log.Println("Monsters successfully crawled.")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jsonFile, err := os.Open("crawler/monsters.json")
	log.Println("Attempting to open monsters.json.")
	if err != nil {
		log.Fatalf("Could not find monsters.json: %s\n", err);
	}
	log.Println("Found and opened latest monsters.json.")
	defer jsonFile.Close()

	fileBytes, _ := ioutil.ReadAll(jsonFile)

	json.Unmarshal([]byte(fileBytes), &result)
	maxNum = len(result)

	log.Println("Starting server ...")
	http.HandleFunc("/api/monsters/", handler)
	log.Printf("Listening on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":" + port, nil))
}

func handler(w http.ResponseWriter, r *http.Request) (){
	log.Printf("Accessing endpoint %s.", r.URL.Path)
	m := validPath.FindStringSubmatch(r.URL.Path)
	if m == nil {
			http.NotFound(w, r)
			return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	log.Println(m[1])
	if m[1] == "" {

		var response [1024]CondensedMonster
		
		for i := 0; i < maxNum; i++ {
			response[i] = CondensedMonster{ result[i].Name, i}
		}
		json.NewEncoder(w).Encode(response[0:maxNum])
	} else {
		var index int;
		var err error;
		if index, err = strconv.Atoi(m[1]); err != nil || index > maxNum {
			http.NotFound(w,r)
			return
		} else {
			json.NewEncoder(w).Encode(result[index])
		}
	}
}

type Monster struct {
	Index 			int `json:"index"`
	Name 				string `json:"name"`
	Size 				string `json:"size"`
	Alignment		string `json:"alignment"`
	Type				string `json:"type"`
	SpecType		string `json:"specType,omitempty"`
	Attributes 	map[string]interface{} `json:"attributes"`
	Abilities 	map[string]interface{} `json:"abilities"`
	Traits 			map[string]interface{} `json:"traits"`
	Actions 		map[string]interface{} `json:"actions"`
	Flavor 			string `json:"flavor,omitempty"`
}

type CondensedMonster struct {
	Name string
	Index int
}
