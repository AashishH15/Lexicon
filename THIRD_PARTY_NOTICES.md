# Third-Party Notices

Lexicon is distributed under the MIT License for Lexicon-authored code; see
[LICENSE](LICENSE). This file records the principal third-party software and
data distributed with or used to build Lexicon. It does not replace the full
license texts or notices shipped by the respective projects.

## LanguageTool

Lexicon includes and launches the LanguageTool Java HTTP server as a separate
process.

Lexicon is an independent project and is not affiliated with, endorsed by, or
sponsored by LanguageTool or its maintainers.

- **Project:** LanguageTool
- **Version:** 6.8
- **Copyright:** LanguageTool community and Daniel Naber
- **License:** GNU Lesser General Public License, version 2.1 or any later
  version (LGPL-2.1-or-later)
- **Official source:**  
  <https://github.com/languagetool-org/languagetool/tree/v6.8>
- **Bundled standalone artifact:**  
  <https://repo1.maven.org/maven2/org/languagetool/languagetool-standalone/6.8/languagetool-standalone-6.8.zip>
- **SHA-256:**  
  `f04aecf37e35ef17d44b336da9668a5a3a871edd14bd83a766a7e110b9ebcd21`
- **License text:** The bundled distribution's `COPYING.txt` file.
- **Upstream license notice:**  
  <https://github.com/languagetool-org/languagetool/blob/v6.8/languagetool-standalone/COPYING.txt>
- **Upstream third-party manifest:**  
  <https://github.com/languagetool-org/languagetool/blob/v6.8/languagetool-standalone/src/main/resources/third-party-licenses/README.txt>

The release bundle preserves LanguageTool's `COPYING.txt`,
`third-party-licenses/`, and language-resource notices. LanguageTool's core is
LGPL-2.1-or-later, but its libraries, dictionaries, frequency data, and other
resources can have separate licenses. The following library list is reproduced
from the LanguageTool 6.8 third-party manifest:

| Component | License |
| --- | --- |
| `at.favre.lib:bcrypt:0.6.0` | Apache-2.0 |
| `at.favre.lib:bytes:0.8.0` | Apache-2.0 |
| `ch.qos.logback:logback-classic:1.2.3` | EPL-1.0 and LGPL |
| `ch.qos.logback:logback-core:1.2.3` | EPL-1.0 and LGPL |
| `com.beust:jcommander:1.78` | Apache-2.0 |
| `com.carrotsearch:hppc:0.8.2` | Apache-2.0 |
| `com.fasterxml.jackson.core:jackson-annotations:2.12.0` | Apache-2.0 |
| `com.fasterxml.jackson.core:jackson-core:2.12.0` | Apache-2.0 |
| `com.fasterxml.jackson.core:jackson-databind:2.12.0` | Apache-2.0 |
| `com.github.lucene-gosen:lucene-gosen:6.2.1` | Apache-2.0 |
| `com.gitlab.dumonts:hunspell:1.1.1` | Apache-2.0 |
| `com.google.android:annotations:4.1.1.4` | Apache-2.0 |
| `com.google.android.tools:dx:1.7` | Apache-2.0 |
| `com.google.api.grpc:proto-google-common-protos:2.0.1` | Apache-2.0 |
| `com.google.code:cjftransform:1.0.1` | Apache-2.0 |
| `com.google.code.findbugs:jsr305:3.0.2` | Apache-2.0 |
| `com.google.code.gson:gson:2.8.6` | Apache-2.0 |
| `com.google.errorprone:error_prone_annotations:2.3.4` | Apache-2.0 |
| `com.google.guava:failureaccess:1.0.1` | Apache-2.0 |
| `com.google.guava:guava:30.1-jre` | Apache-2.0 |
| `com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava` | Apache-2.0 |
| `com.google.j2objc:j2objc-annotations:1.3` | Apache-2.0 |
| `com.google.protobuf:protobuf-java:3.17.2` | BSD-3-Clause |
| `com.hankcs:aho-corasick-double-array-trie:1.2.2` | Apache-2.0 |
| `com.hankcs:hanlp:portable-1.7.8` | Apache-2.0 |
| `com.ibm.icu:icu4j:56.1` | ICU License |
| `com.intellij:annotations:12.0` | Apache-2.0 |
| `com.nativelibs4java:bridj:0.7.0` | New BSD |
| `com.optimaize.languagedetector:language-detector:0.6` | Apache-2.0 |
| `com.sparkjava:spark-core:2.9.3` | Apache-2.0 |
| `com.sun.istack:istack-commons-runtime:3.0.5` | CDDL-1.1 and GPL-2.0 with Classpath Exception |
| `com.sun.xml.fastinfoset:FastInfoset:1.2.13` | Apache-2.0 |
| `com.vdurmont:emoji-java:5.1.1` | MIT |
| `commons-beanutils:commons-beanutils:1.9.4` | Apache-2.0 |
| `commons-cli:commons-cli:1.4` | Apache-2.0 |
| `commons-codec:commons-codec:1.14` | Apache-2.0 |
| `commons-digester:commons-digester:2.1` | Apache-2.0 |
| `commons-io:commons-io:2.8.0` | Apache-2.0 |
| `commons-logging:commons-logging:1.2` | Apache-2.0 |
| `commons-validator:commons-validator:1.7` | Apache-2.0 |
| `de.danielnaber:german-pos-dict:1.2.2` | CC BY-SA 4.0 |
| `de.danielnaber:jwordsplitter:4.5` | Apache-2.0 |
| `edu.washington.cs.knowitall:opennlp-chunk-models:1.5` | Apache-2.0 |
| `edu.washington.cs.knowitall:opennlp-postag-models:1.5` | Apache-2.0 |
| `edu.washington.cs.knowitall:opennlp-tokenize-models:1.5` | Apache-2.0 |
| `edu.washington.cs.knowitall:openregex:1.1.1` | LGPL |
| `io.github.jimregan:languagetool-ga-dicts:0.02` | GPL-2.0 |
| `io.github.resilience4j:resilience4j-circuitbreaker:1.7.1` | Apache-2.0 |
| `io.github.resilience4j:resilience4j-core:1.7.1` | Apache-2.0 |
| `io.github.resilience4j:resilience4j-micrometer:1.7.1` | Apache-2.0 |
| `io.grpc:grpc-api:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-context:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-core:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-netty-shaded:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-protobuf:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-protobuf-lite:1.42.1` | Apache-2.0 |
| `io.grpc:grpc-stub:1.42.1` | Apache-2.0 |
| `io.lettuce:lettuce-core:6.1.5.RELEASE` | Apache-2.0 |
| `io.micrometer:micrometer-core:1.7.1` | Apache-2.0 |
| `io.micrometer:micrometer-registry-prometheus:1.7.1` | Apache-2.0 |
| `io.netty:netty-buffer:4.1.68.Final` | Apache-2.0 |
| `io.netty:netty-codec:4.1.68.Final` | Apache-2.0 |
| `io.netty:netty-common:4.1.68.Final` | Apache-2.0 |
| `io.netty:netty-handler:4.1.68.Final` | Apache-2.0 |
| `io.netty:netty-resolver:4.1.68.Final` | Apache-2.0 |
| `io.netty:netty-transport:4.1.68.Final` | Apache-2.0 |
| `io.perfmark:perfmark-api:0.23.0` | Apache-2.0 |
| `io.projectreactor:reactor-core:3.3.20.RELEASE` | Apache-2.0 |
| `io.prometheus:simpleclient:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_common:0.10.0` | Apache-2.0 |
| `io.prometheus:simpleclient_guava:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_hotspot:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_httpserver:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_tracer_common:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_tracer_otel:0.12.0` | Apache-2.0 |
| `io.prometheus:simpleclient_tracer_otel_agent:0.12.0` | Apache-2.0 |
| `io.vavr:vavr:0.10.2` | Apache-2.0 |
| `io.vavr:vavr-match:0.10.2` | Apache-2.0 |
| `javax.activation:javax.activation-api:1.2.0` | CDDL-1.1 and GPLv2 with Classpath Exception |
| `javax.annotation:javax.annotation-api:1.3.2` | CDDL-1.1 and GPLv2 with Classpath Exception |
| `javax.measure:unit-api:1.0` | BSD |
| `javax.servlet:javax.servlet-api:3.1.0` | CDDL-1.1 and GPLv2 with Classpath Exception |
| `javax.xml.bind:jaxb-api:2.3.0` | CDDL-1.1 and GPLv2 with Classpath Exception |
| `junit:junit:4.13.2` | EPL-1.0 |
| `net.arnx:jsonic:1.2.11` | Apache-2.0 |
| `net.loomchild:segment:2.0.1` | MIT |
| `org.apache.commons:commons-collections4:4.1` | Apache-2.0 |
| `org.apache.commons:commons-lang3:3.11` | Apache-2.0 |
| `org.apache.commons:commons-pool2:2.9.0` | Apache-2.0 |
| `org.apache.commons:commons-text:1.9` | Apache-2.0 |
| `org.apache.lucene:lucene-backward-codecs:5.5.5` | Apache-2.0 |
| `org.apache.lucene:lucene-core:5.5.5` | Apache-2.0 |
| `org.apache.opennlp:opennlp-tools:1.9.4` | Apache-2.0 |
| `org.carrot2:morfologik-fsa:2.1.7` | BSD |
| `org.carrot2:morfologik-fsa-builders:2.1.7` | BSD |
| `org.carrot2:morfologik-speller:2.1.7` | BSD |
| `org.carrot2:morfologik-stemming:2.1.7` | BSD |
| `org.carrot2:morfologik-tools:2.1.7` | BSD |
| `org.checkerframework:checker-qual:3.5.0` | MIT |
| `org.eclipse.jetty:jetty-client:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-http:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-io:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-security:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-server:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-servlet:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-util:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-util-ajax:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-webapp:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty:jetty-xml:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty.websocket:websocket-api:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty.websocket:websocket-client:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty.websocket:websocket-common:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty.websocket:websocket-server:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.eclipse.jetty.websocket:websocket-servlet:9.4.44.v20210927` | Apache-2.0 and EPL-1.0 |
| `org.glassfish.jaxb:jaxb-core:2.3.0` | CDDL-1.1 and GPL-2.0 |
| `org.glassfish.jaxb:jaxb-runtime:2.3.0` | CDDL-1.1 and GPL-2.0 |
| `org.glassfish.jaxb:txw2:2.3.0` | CDDL-1.1 and GPL-2.0 |
| `org.hamcrest:hamcrest-core:1.3` | New BSD |
| `org.hdrhistogram:HdrHistogram:2.1.12` | BSD-2-Clause and CC0 |
| `org.ioperm:morphology-el:1.0.0` | Apache-2.0 and CC BY-SA 4.0 |
| `org.jetbrains:annotations:20.1.0` | Apache-2.0 |
| `org.jetbrains.intellij.deps:trove4j:1.0.20200330` | LGPL-2.1 |
| `org.json:json:20170516` | JSON License |
| `org.jvnet.staxex:stax-ex:1.7.8` | CDDL-1.1 and GPL-2.0 |
| `org.latencyutils:LatencyUtils:2.0.3` | Public Domain and CC0 |
| `org.mariadb.jdbc:mariadb-java-client:2.7.4` | LGPL-2.1 |
| `org.mybatis:mybatis:3.5.6` | Apache-2.0 |
| `org.reactivestreams:reactive-streams:1.0.3` | CC0 |
| `org.slf4j:slf4j-api:1.7.30` | MIT |
| `org.softcatala:catalan-pos-dict:2.16` | GPL-2.0 and LGPL-2.1 |
| `org.softcatala:spanish-pos-dict:1.4` | LGPL-2.1 |
| `tech.units:indriya:1.3` | BSD |
| `tech.uom.lib:uom-lib-common:1.1` | BSD |
| `ua.net.nlp:morfologik-ukrainian-lt:5.6.0` | LGPL |

LanguageTool also notes that dictionaries and other language resources are
not technically libraries and can have different licenses. In particular,
some resources use GPL, LGPL, Creative Commons Attribution, or Creative
Commons Attribution-ShareAlike terms. The authoritative notices are the
language-specific `README*` and `LICENSE*` files under
`org/languagetool/resource/<language>/` in the bundled distribution.

## Bundled Java runtime

Desktop releases include an Eclipse Temurin JRE from the Eclipse Adoptium
project so users do not need to install Java separately. The exact runtime
varies by target:

| Target | Runtime archive |
| --- | --- |
| Windows x86 | Temurin JRE 17.0.17+10, [archive](https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.17%2B10/OpenJDK17U-jre_x86-32_windows_hotspot_17.0.17_10.zip) |
| Windows x64 | Temurin JRE 21.0.5+11, [archive](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_x64_windows_hotspot_21.0.5_11.zip) |
| Windows ARM64 | Temurin JRE 21.0.5+11, [archive](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_aarch64_windows_hotspot_21.0.5_11.zip) |
| macOS Intel | Temurin JRE 21.0.5+11, [archive](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_x64_mac_hotspot_21.0.5_11.tar.gz) |
| macOS Apple Silicon | Temurin JRE 21.0.5+11, [archive](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_aarch64_mac_hotspot_21.0.5_11.tar.gz) |
| Linux x64 | Temurin JRE 21.0.5+11, [archive](https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_x64_linux_hotspot_21.0.5_11.tar.gz) |

The OpenJDK portions of Temurin are primarily distributed under GPL-2.0 with
the Classpath Exception and GPL-2.0 with the OpenJDK Assembly Exception.
Other files can use Apache-2.0, Eclipse Public License 2.0, Eclipse
Distribution License 1.0/BSD-3-Clause, or other terms. The complete
license and notice files shipped inside each Temurin archive are retained in
the installed `jre/` resource directory.

- [Eclipse Adoptium licensing information](https://adoptium.net/what-we-do)
- [Eclipse Adoptium FAQ](https://adoptium.net/docs/faq)
- [Temurin build repository](https://github.com/adoptium/temurin-build)
- [OpenJDK GPLv2 Classpath Exception](https://openjdk.org/legal/gplv2+ce/)

## Lexicon runtime and build dependencies

The following direct dependencies are used by Lexicon. Their full license
texts remain available from their upstream projects and package metadata.
Versions are controlled by `backend/requirements.txt`,
`frontend/package-lock.json`, the frontend manifests, and the Rust manifests.

### Python backend

| Dependency | License | Upstream |
| --- | --- | --- |
| FastAPI | MIT | <https://github.com/fastapi/fastapi> |
| Uvicorn | BSD-3-Clause | <https://github.com/encode/uvicorn> |
| Requests | Apache-2.0 | <https://github.com/psf/requests> |
| Hugging Face Hub | Apache-2.0 | <https://github.com/huggingface/huggingface_hub> |
| `llama-cpp-python` (optional bundled AI backend) | MIT | <https://github.com/abetlen/llama-cpp-python> |
| PyInstaller (build tool and bootloader) | GPL-2.0-or-later with Bootloader Exception; selected files Apache-2.0 | <https://pyinstaller.org/en/stable/license.html> |

### Frontend and desktop shell

| Dependency | License | Upstream |
| --- | --- | --- |
| React and React DOM | MIT | <https://github.com/facebook/react> |
| Vite | MIT | <https://github.com/vitejs/vite> |
| Tailwind CSS | MIT | <https://github.com/tailwindlabs/tailwindcss> |
| Tauri and official Tauri plugins | MIT or Apache-2.0, as applicable | <https://github.com/tauri-apps/tauri> |
| TipTap packages | MIT | <https://github.com/ueberdosis/tiptap> |
| Phosphor Icons | MIT | <https://github.com/phosphor-icons> |
| JSZip | MIT | <https://github.com/Stuk/jszip> |
| KaTeX | MIT | <https://github.com/KaTeX/KaTeX> |
| lowlight | MIT | <https://github.com/wooorm/lowlight> |
| marked | MIT | <https://github.com/markedjs/marked> |
| Turndown | MIT | <https://github.com/mixmark-io/turndown> |
| Mammoth.js | BSD-2-Clause | <https://github.com/mwilliamson/mammoth.js> |

### Rust dependencies

| Dependency | License | Upstream |
| --- | --- | --- |
| Tauri Rust crates and official plugins | MIT or Apache-2.0, as applicable | <https://github.com/tauri-apps/tauri> |
| Serde and serde_json | MIT or Apache-2.0 | <https://github.com/serde-rs/serde> |
| `url` | MIT or Apache-2.0 | <https://github.com/servo/rust-url> |

Rust transitive dependencies are resolved from the Cargo manifests and
registry metadata at build time. Their upstream notices and license terms
remain applicable.

## Distribution obligations

When redistributing Lexicon, retain this file, the repository's MIT license,
the LanguageTool `COPYING.txt` and `third-party-licenses/` directory, the
language-resource notices, and the JRE license/notice files. Nothing in this
file changes the license of Lexicon, LanguageTool, the JRE, or any other
third-party component.
