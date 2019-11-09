# subs-translate

> Tool to mass translate VTT subtitle files into other languages using Google Translate API v3. Additionally, SRT files can be converted to VTT, in bulk.

To use this tool, the user must provide their own private key .JSON file downloaded from the Google Cloud Platform page when configuring a project with the Google Cloud Translate API.

Google API v3 has been used, and not v2, because the new version of the API has better translation quality.

The Google Translate API v3 can be used free of charge for the first 12 months after registration, a credit card is required and has a translation limit of 500,000 monthly characters.

## Usage

### First steps

* Create an account in Google Cloud Platform with a valid credit card.

* Follow the steps on this page: https://cloud.google.com/translate/docs/quickstart to create a new project and enable it to use the Cloud Translation API service

* Download the JSON file that contains the private data of the created project. Be very careful not to share it in a public repository like GITHUB

### Install globally

```bash
 npm i bySabi/subs-translate -g
```

> or use it without install, Ex:

```bash
 npx bySabi/subs-translate translate-api videos/ --key private-key.json
```

## CLI
```

$ subs-translate --help
Usage: subs-translate <command> [options]

Commands:
subs-translate translate-api <src> [dest] Translate source path SRT|VTT to VTT
dest path using Google API v3 [Registration required]

subs-translate convert <src> [dest] Convert only source path SRT to VTT dest path

Options:
--key path to Google private key JSON
--slang, -s current lang of the file 					  [default: "en"]
--tlang, -t target lang of the file 					  [default: "es"]
--depth depth folder recursion. Disable with '--no-depth' [default: true]
--purge purge original file 							  [default: false]
--out output to folder  
--force force overwrite existing file 					  [default: false]
--skip skip if already .LANG.vtt file exists 			  [default: true]
-h, --help Show help  
-v, --version Show version number

```

### CLI Examples

* Bulk convert all SRT files to VTT in a folder recursively
```bash
$ subs-translate convert videos/
```

* Translate SRT file
```bash
$ subs-translate convert example.srt example.vtt
$ subs-translate translate-api example.vtt --slang en --tlang es --key ~/Dekstop/private-key.json
```

* Bulk translate all VTT in a folder, without recursion, from english to spanish (default translation)
```bash
$ subs-translate translate-api myVTTfolder/ --no-depth --key ~/Dekstop/private-key.json
```

## CAUTION!!

This is a project created for my own use. I have shared it in case anyone has to be useful. **Use it at your own risk**

## Credits

### author

- bySabi Files <> [@bySabi](https://github.com/bySabi)

## Contributing

- Documentation improvement
- Feel free to send any PR

## License

[MIT](./LICENSE)
```
