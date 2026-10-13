// Optional JSON-lines interface. Normal CLI/WASM builds keep their original I/O.
#include <iostream>
#include <set>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include <boost/algorithm/string/trim.hpp>
#include "books.h"
#include "cli.h"

using nlohmann::json;
extern bool booksAdded, texmacs_mode;
extern std::string text[2], diagram;
extern std::vector<bool> textset;
extern std::vector<std::string> vocabulary;
extern std::string error_color;
extern void set_colors(bool);
extern std::string cli_process(char *);
bool machine_mode = false;
static bool streaming = false, failed = false, initialization_failed = false;

static void emit(const json &event) { std::cout << event.dump() << '\n' << std::flush; }

void machine_emit(bool is_error, const std::string &message) {
    if (!streaming) { if (is_error) initialization_failed = true; return; }
    if (is_error) failed = true;
    const bool svg = !is_error && message.find("<svg") != std::string::npos &&
        (message.compare(0, 5, "<?xml") == 0 || message.compare(0, 9, "<!DOCTYPE") == 0);
    std::string kind = svg ? "svg" : "text";
    emit({{"type", "output"}, {"kind", kind}, {"error", is_error}, {"text", message + "\n"}});
}

int machine_main() {
    machine_mode = true;
    try {
        std::string line;
        if (!std::getline(std::cin, line) || line.size() > 1048576) throw std::runtime_error("Invalid request size");
        auto request = json::parse(line);
        machine_mode = true;
        output_prepend_set = const_cast<char *>("");
        texmacs_mode = false;
        set_colors(false);
        showAvailableBibles();
        if (addBibles() != 0 || initialization_failed) throw std::runtime_error("Cannot load the prebuilt module cache");
        booksAdded = true;
        if (request.value("metadata", false)) {
            std::set<std::string> unique(vocabulary.begin(), vocabulary.end());
            emit({{"type", "metadata"}, {"vocabulary", std::vector<std::string>(unique.begin(), unique.end())},
                  {"version", BIBREF_GUI_VERSION}, {"databaseVersion", BIBREF_VERSION}});
            return 0;
        }
        auto state = request.at("state");
        for (int i = 0; i < 2; ++i) {
            text[i] = state.at("text").at(i).get<std::string>();
            if (text[i].size() > 65536) throw std::runtime_error("Clipboard exceeds 64 KiB");
            textset[i] = state.at("textset").at(i).get<bool>();
        }
        maxresults = state.at("maxresults").get<int>();
        diagram = state.at("diagram").get<std::string>();
        if (maxresults < 0) throw std::runtime_error("Invalid result limit");
        set_colors(state.at("colors").get<bool>());
        std::string command = request.at("command").get<std::string>();
        if (command.size() > 65536 || command.find('\0') != std::string::npos) throw std::runtime_error("Invalid command size");
        std::string control = command.substr(0, command.find("#"));
        boost::algorithm::trim(control);
        streaming = true;
        const bool fingerprint_command = control == "compare12" || control == "jaccard12" || control == "nearest12";
        if (fingerprint_command) {
            for (int i = 0; i < 2; ++i) for (unsigned char c : text[i]) {
                if (c < 'a' || c > 'z') throw std::runtime_error("Clipboard analysis requires a-z text");
            }
        }
        if (control == "quit") {
            machine_emit(false, "Goodbye.");
        } else {
            std::vector<char> input(command.begin(), command.end()); input.push_back('\0');
            cli_process(input.data());
        }
        if (text[0].size() > 65536 || text[1].size() > 65536) throw std::runtime_error("Clipboard exceeds 64 KiB");
        emit({{"type", "result"}, {"ok", !failed}, {"closed", control == "quit"},
              {"state", {{"text", {text[0], text[1]}}, {"textset", {bool(textset[0]), bool(textset[1])}},
                         {"maxresults", maxresults}, {"diagram", diagram}, {"colors", !error_color.empty()}}}});
        return 0;
    } catch (const std::exception &) {
        // Parser/library details are not exposed to a public caller or platform logs.
        emit({{"type", "fatal"}, {"code", "engine_error"}, {"message", "Command could not be executed safely."}});
        return 1;
    }
}
