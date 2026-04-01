export const MORSE_CODE: Record<string, string> = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F",
  "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
  "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
  "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
  "-.--": "Y", "--..": "Z", "-----": "0", ".----": "1", "..---": "2",
  "...--": "3", "....-": "4", ".....": "5", "-....": "6", "--...": "7",
  "---..": "8", "----.": "9", ".-.-.-": ".", "--..--": ",", "---...": ":",
  "..--..": "?", ".----.": "'", "-....-": "-", "-..-.": "/", ".--.-.": "@",
  "-...-": "=", ".-.-.": "+", "-.-.--": "!"
};

const REVERSE_MORSE: Record<string, string> = Object.entries(MORSE_CODE).reduce(
  (acc, [code, char]) => ({ ...acc, [char]: code }),
  {} as Record<string, string>
);

export const decodeMorse = (code: string): string => {
  return code
    .trim()
    .split("   ") // Words
    .map(word => 
      word
        .split(" ") // Characters
        .map(char => MORSE_CODE[char] || "?")
        .join("")
    )
    .join(" ");
};

export const encodeMorse = (text: string): string => {
  return text
    .toUpperCase()
    .split("")
    .map(char => {
      if (char === " ") return "   ";
      return REVERSE_MORSE[char] || "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};
