// Optional JSON-lines interface. Normal CLI/WASM builds keep their original I/O.
#include <iostream>
#include <set>
#include <sstream>
#include <regex>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include <boost/algorithm/string/trim.hpp>
#include "books.h"
#include "book.h"
extern Book getBook(std::string, std::string);
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
static constexpr size_t clipboard_bytes = 262144;
static bool streaming = false, failed = false, initialization_failed = false;

static json diagram_fragments = json::array();

// Metadata originates from parser intervals, never from visible diagram labels.
void machine_diagram_metadata(const std::string &analysis, const std::string &graphviz) {
    diagram_fragments = json::array();
    std::istringstream lines(analysis); std::string line;
    const std::string marker = "diagram: metadata: ";
    while (std::getline(lines, line)) {
        auto pos = line.find(marker); if (pos == std::string::npos) continue;
        std::istringstream fields(line.substr(pos + marker.size()));
        std::vector<std::string> values; std::string field;
        while (std::getline(fields, field, '\t')) values.push_back(field);
        if (values.size() != 7) continue;
        const int start = std::stoi(values[3]), length = std::stoi(values[4]);
        const std::string raw = getRaw(values[1], values[2], start - 1, length);
        Book book = getBook(values[2], values[1]);
        const std::string reference = book.getVerseInfoStart(start - 1) + " " + book.getVerseInfoEnd(start + length - 2);
        json matches = json::array();
        const std::regex edge(" (nt[0-9]+)->(i[0-9]+) ");
        for (std::sregex_iterator it(graphviz.begin(), graphviz.end(), edge), end; it != end; ++it) {
            if ((*it)[1] == values[0]) matches.push_back("bibref-" + (*it)[2].str());
            if ((*it)[2] == values[0]) matches.push_back("bibref-" + (*it)[1].str());
        }
        diagram_fragments.push_back({{"id", "bibref-" + values[0]}, {"kind", values[6]}, {"module", values[1]}, {"book", values[2]},
            {"start", start}, {"end", start + length - 1}, {"length", length}, {"passage", values[5]}, {"reference", reference},
            {"greek", latinToGreek(raw)}, {"matches", matches}});
    }
}

static void emit(const json &event) { std::cout << event.dump() << '\n' << std::flush; }

void machine_emit(bool is_error, const std::string &message) {
    if (!streaming) { if (is_error) initialization_failed = true; return; }
    if (is_error) failed = true;
    const bool svg = !is_error && message.find("<svg") != std::string::npos &&
        (message.compare(0, 5, "<?xml") == 0 || message.compare(0, 9, "<!DOCTYPE") == 0);
    std::string kind = svg ? "svg" : "text";
    json event = {{"type", "output"}, {"kind", kind}, {"error", is_error}, {"text", message + "\n"}};
    if (svg) { event["fragments"] = diagram_fragments; diagram_fragments = json::array(); }
    emit(event);
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
            if (text[i].size() > clipboard_bytes) throw std::runtime_error("Clipboard exceeds 256 KiB");
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
        if (text[0].size() > clipboard_bytes || text[1].size() > clipboard_bytes) throw std::runtime_error("Clipboard exceeds 256 KiB");
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
