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
	// cmd := exec.Command("node", "crawler/index.js")
	// log.Println("Calling node ...")
	// execErr := cmd.Run()
	// if execErr != nil {
	// 	log.Fatalf("node crawler/index.js failed with: %s\n", execErr)
	// }
	// log.Println("Monsters successfully crawled.")

	jsonFile, err := os.Open("monsters.json")
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
	log.Fatal(http.ListenAndServe(":8080", nil))
	log.Println("Listening on port 8080...")
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
	Name string `json:"name"`
	Attributes map[string]interface{} `json:attributes`
	Abilities map[string]interface{} `json:"abilities"`
	Traits map[string]interface{} `json:"traits"`
	Actions map[string]interface{} `json:"actions"`
	Flavor string `json:"flavor"`
}

type CondensedMonster struct {
	Name string
	Index int
}
