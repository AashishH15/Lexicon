import { forwardRef } from "react";
import { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowCounterClockwise,
  IconBase,
  ShieldCheck,
  Sliders,
  Cpu,
  Lightning,
  Keyboard,
  Info,
  BookBookmark,
  ClockCounterClockwise,
  Trash,
  MagnifyingGlass,
  Plus,
  Copy,
  Check,
  FloppyDisk,
  LockSimple,
  LockSimpleOpen,
  FileText,
  Robot,
  PaperPlaneTilt,
  Palette,
} from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import LanguageDropdown from "./LanguageDropdown.jsx";
import ModelManager from "./ModelManager.jsx";
import CustomToolsSettings from "./CustomToolsSettings.jsx";
import { TYPOGRAPHY_PRESETS } from "./typographyPresets.js";
import { PAPER_TEXTURES } from "./paperTextures.js";
import { READING_MODES } from "./readingMode.js";
import { setAiPreference, openExternalUrl } from "./api.js";

const githubWeights = new Map([
  [
    "thin",
    <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />,
  ],
  [
    "light",
    <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />,
  ],
  [
    "regular",
    <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />,
  ],
  [
    "bold",
    <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />,
  ],
  [
    "fill",
    <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />,
  ],
  [
    "duotone",
    <>
      <path
        d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z"
        opacity="0.2"
      />
      <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />
    </>,
  ],
]);

const GithubLogo = forwardRef((props, ref) => (
  <IconBase ref={ref} {...props} weights={githubWeights} />
));

GithubLogo.displayName = "GithubLogo";

const LexiconLogo = ({ size = 16, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 2048 2048"
    width={size}
    height={size}
    {...props}
  >
    <path
      fill="currentColor"
      d="M 1023.74 669.098 C 1031.09 661.841 1040.31 654.74 1047.12 647.482 C 1089.89 601.874 1139.65 568.328 1191.13 533.777 C 1249.71 494.455 1306.5 466.161 1372.79 441.684 C 1433.76 419.172 1495.02 397.389 1559.63 388.509 C 1572.71 386.624 1588.52 396.366 1590.48 409.596 C 1592.9 425.934 1591.98 444.594 1591.96 461.253 L 1592.06 547.106 C 1624.04 540.147 1671.05 531.994 1703.94 530.039 C 1709.51 530.318 1716.17 532.27 1720.69 535.379 C 1734.27 544.731 1731.98 563.83 1732.04 578.125 L 1732.17 626.87 L 1732.17 805.051 L 1732.2 1300.34 C 1731.93 1339.13 1732.32 1378.03 1731.98 1416.82 C 1731.59 1423.97 1731.92 1437.15 1727.13 1442.98 C 1712.92 1460.28 1671.9 1460.05 1650.75 1463.42 C 1640.67 1464.29 1626.19 1466.94 1615.94 1468.51 C 1596.21 1471.39 1576.51 1474.48 1556.85 1477.77 C 1392.9 1505.8 1207.04 1550.46 1064.75 1639.96 C 1016.68 1670.19 1023.49 1657.52 976.235 1629.91 C 929.066 1602.35 877.882 1581.67 826.593 1563.7 C 722.165 1527.35 614.95 1499.57 506.012 1480.63 C 455.146 1471.75 403.625 1465.35 352.525 1457.82 C 325.434 1453.83 315.961 1446.14 315.795 1417.83 C 315.656 1394.07 315.941 1370.1 315.814 1346.35 C 315.146 1285.67 314.934 1225 315.179 1164.32 L 315.733 743.155 L 315.861 606.454 C 315.874 589.774 314.445 566.87 316.754 550.855 C 320.539 524.604 353.05 530.014 369.844 532.657 C 398.701 537.198 428.005 540.995 455.943 548.25 C 456.948 539.639 456.496 530.235 456.295 521.526 C 455.723 496.68 456.647 471.967 456.926 447.135 C 457.195 423.248 450.507 393.033 482.821 388.385 C 496.995 388.453 510.45 391.476 524.179 394.935 C 627.701 421.022 732.793 457.314 824.447 512.766 C 872.827 543.041 921.65 574.428 964.698 612.115 C 984.635 629.569 1004.91 650.379 1023.74 669.098 z M 512.585 1259.85 C 546.184 1270.94 581.27 1277.6 614.873 1288.09 C 757.856 1332.74 905.346 1400.93 1002.36 1518.95 C 1009.16 1527.23 1017.44 1540.59 1024.92 1547.53 C 1127.19 1393 1359.81 1300.2 1533.96 1259.94 C 1535.14 1153.13 1535.46 1046.32 1534.92 939.5 C 1534.93 885.905 1536.9 458.691 1533.56 451.972 C 1525.51 451.374 1492.77 461.689 1482.37 464.401 C 1354.97 497.343 1236.61 558.517 1136.05 643.394 C 1106.77 668.578 1078.8 694.584 1054.22 724.434 C 1052.31 735.385 1052.85 749.509 1052.89 760.761 L 1053.17 812.992 C 1053.54 840.067 1053.75 867.144 1053.79 894.222 C 1053.64 941.001 1053.67 989.171 1052.59 1035.9 C 1052.46 1041.49 1046.85 1048.92 1042.32 1052.19 C 1035.86 1056.85 1027.79 1058.69 1019.95 1057.3 C 989.646 1052.01 995.811 1019.58 995.952 996.78 L 995.871 937.814 L 995.85 726.683 C 981.34 708.944 968.993 698.249 953.343 682.373 C 853.625 581.205 730.493 514.091 595.224 473.274 C 572.477 466.41 536.172 455.419 512.9 450.889 L 512.213 1005.18 L 512.202 1166.56 C 512.374 1193.8 514.503 1234.2 512.585 1259.85 z M 1670.59 590.445 C 1644.09 593.668 1618.52 598.052 1591.83 600.608 L 1591.87 1069.04 L 1591.9 1216.89 C 1591.92 1241.1 1592.12 1265.32 1591.67 1289.54 C 1591.33 1307.9 1569.62 1309.66 1555.89 1313.37 C 1531.64 1319.92 1506.61 1323.93 1482.37 1330.58 C 1359.37 1364.01 1228.86 1426.17 1132.57 1510.05 C 1123.3 1518.13 1093.32 1544.3 1091.08 1552.98 L 1092.15 1554.19 C 1095.51 1553.72 1095.96 1553.36 1099.02 1552.07 C 1124.07 1542.63 1149 1529.84 1175.23 1520.28 C 1269.01 1487.14 1365.09 1460.89 1462.69 1441.74 C 1508.87 1432.11 1555.28 1423.64 1601.88 1416.34 C 1623.66 1412.72 1655.4 1409.7 1675.57 1403.6 C 1676.49 1355.79 1675.96 1305.95 1675.93 1257.94 L 1675.51 988.448 L 1675.31 777 C 1675.56 717.886 1675.82 658.723 1675.87 599.599 C 1675.87 595.85 1676.22 592.386 1674.02 590.029 L 1670.59 590.445 z M 456.151 601.472 C 429.132 597.553 398.991 592.703 372.078 589.782 L 372.054 1404.3 C 404.037 1410.81 436.313 1414.22 468.36 1420.25 C 490.499 1424.42 512.856 1427.61 534.983 1431.78 C 643.35 1451.63 750.13 1479.33 854.482 1514.67 C 877.517 1522.52 900.251 1531.23 922.636 1540.78 C 930.032 1543.89 951.863 1555.72 958.457 1553.53 C 948.735 1538 927.302 1519.77 913.085 1507.62 C 852.275 1455.63 780.187 1414.71 707.504 1381.87 C 691.862 1374.8 675.057 1367 659.158 1361 C 618.545 1345.71 576.888 1333.36 534.507 1324.03 C 512.323 1318.95 488.867 1315.07 467.553 1307.09 C 459.228 1303.97 457.555 1293.07 457.159 1285.64 C 454.181 1229.71 457.314 1173.34 456.939 1117.48 L 456.178 722.359 L 456.244 642.793 C 456.291 629.555 457.428 614.263 456.151 601.472 z"
    />
    <path
      fill="#6FCCFD"
      d="M 766.72 1041.49 C 779.047 1040.65 793.203 1042.34 805.565 1043.82 C 864.76 1050.95 898.82 1070.57 947.115 1102 C 995.626 1133.58 1041.65 1140.86 1095.75 1118.34 C 1115.83 1109.99 1134.78 1099.13 1154.82 1090.79 C 1174.24 1082.71 1195.5 1076.73 1216.09 1072.43 C 1251.32 1065.07 1354.94 1055.99 1383.15 1075.44 C 1391.16 1080.96 1395.92 1089.45 1397.34 1098.99 C 1398.79 1108.67 1396.84 1118.7 1390.84 1126.56 C 1375.83 1146.22 1330.71 1137.94 1308.5 1138.1 C 1291.72 1138.21 1274.49 1139.22 1257.89 1141.68 C 1230.05 1144.82 1189.8 1155.66 1163.98 1167.34 C 1118.44 1187.96 1086.28 1205.75 1033.81 1205.14 C 978.492 1204.49 938.433 1182.06 893.754 1152.48 C 856.883 1128.07 816.484 1112.3 771.496 1114.86 C 753.936 1116.22 728.411 1119.06 712.005 1126.43 C 683.116 1139.4 646.734 1147.19 640.21 1104.49 C 639.016 1096.68 643.766 1078.48 650.802 1073.08 C 681.908 1049.2 728.585 1042.63 766.72 1041.49 z"
    />
  </svg>
);

LexiconLogo.displayName = "LexiconLogo";

const GITHUB_URL = "https://github.com/AashishH15/Lexicon";

export const LANGUAGES = [
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-CA", label: "English (Canada)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-NZ", label: "English (New Zealand)" },
  { code: "en-ZA", label: "English (South Africa)" },
];

export const FONT_SIZES = [14, 16, 18];

export const LINE_SPACINGS = [
  { value: 1.6, label: "Standard" },
  { value: 1.8, label: "Comfortable" },
];

export const SETTINGS_DEFAULTS = {
  language: "en-US",
  fontSize: 16,
  focusMode: false,
  lineSpacing: 1.6,
  proseScanEnabled: false,
  betaOptIn: false,
  typographyPreset: "current",
  paperTexture: "plain-white",
  readingMode: "off",
};

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { action: "Open command menu", keys: ["type /"] },
  { action: "Trigger Proofread", keys: [mod, "Enter"] },
  { action: "Accept Suggestion", keys: ["Ctrl", "Alt", "A"] },
  { action: "Dismiss Suggestion", keys: ["Ctrl", "Alt", "D"] },
  { action: "Toggle Settings", keys: [mod, ","] },
  { action: "Close Settings", keys: ["Esc"] },
  { action: "Inline math", keys: ["type $your latex$"] },
  { action: "Block math", keys: ["type $$$your latex$$$"] },
  { action: "Bold", keys: [mod, "B"] },
  { action: "Italic", keys: [mod, "I"] },
  { action: "Underline", keys: [mod, "U"] },
  { action: "Strikethrough", keys: [mod, "Shift", "S"] },
  { action: "Highlight", keys: [mod, "Shift", "H"] },
  { action: "Inline code", keys: [mod, "E"] },
  { action: "Align left", keys: [mod, "Shift", "L"] },
  { action: "Align center", keys: [mod, "Shift", "E"] },
  { action: "Align right", keys: [mod, "Shift", "R"] },
  { action: "Align justify", keys: [mod, "Shift", "J"] },
  { action: "Heading 1", keys: [mod, "Alt", "1"] },
  { action: "Heading 2", keys: [mod, "Alt", "2"] },
  { action: "Heading 3", keys: [mod, "Alt", "3"] },
  { action: "Heading 4", keys: [mod, "Alt", "4"] },
  { action: "Heading 5", keys: [mod, "Alt", "5"] },
  { action: "Heading 6", keys: [mod, "Alt", "6"] },
  { action: "Undo", keys: [mod, "Z"] },
  { action: "Redo", keys: [mod, "Shift", "Z"] },
  { action: "Indent list item", keys: ["Tab"] },
  { action: "Outdent list item", keys: ["Shift", "Tab"] },
];

const TABS = [
  { id: "general", label: "General", icon: Sliders },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dictionary", label: "Your Dictionary", icon: BookBookmark },
  { id: "history", label: "History & Drafts", icon: ClockCounterClockwise },
  { id: "ai", label: "Lex's Engine", icon: Cpu },
  { id: "actions", label: "Custom Actions", icon: Lightning },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "about", label: "About & Feedback", icon: Info },
];

const SEARCH_INDEX = [
  {
    label: "Font Size",
    tab: "general",
    settingKey: "font-size",
    keywords: ["font", "font size", "text size", "size"],
  },
  {
    label: "Focus Mode",
    tab: "general",
    settingKey: "focus-mode",
    keywords: ["focus", "focus mode", "distraction"],
  },
  {
    label: "Language & Grammar",
    tab: "general",
    settingKey: "language",
    keywords: ["language", "grammar", "spelling", "english"],
  },
  {
    label: "Line Spacing",
    tab: "general",
    settingKey: "line-spacing",
    keywords: ["line spacing", "spacing", "comfortable"],
  },
  {
    label: "Prose Scan",
    tab: "general",
    settingKey: "prose-scan",
    keywords: ["prose", "scan", "proofread"],
  },
  {
    label: "Reset Defaults",
    tab: "general",
    settingKey: "reset-defaults",
    keywords: ["reset", "defaults", "restore"],
  },
  {
    label: "Your Dictionary",
    tab: "dictionary",
    settingKey: "dictionary-section",
    keywords: ["dictionary", "word", "words", "vocabulary", "spell check"],
  },
  {
    label: "History & Drafts",
    tab: "history",
    settingKey: "history-section",
    keywords: [
      "history",
      "draft",
      "drafts",
      "auto-save",
      "save",
      "transform",
      "versions",
    ],
  },
  {
    label: "Lex's Engine",
    tab: "ai",
    settingKey: "lex-engine-section",
    keywords: [
      "ai",
      "model",
      "engine",
      "ollama",
      "local",
      "download",
      "inference",
      "bundled",
      "lexicon model",
    ],
  },
  {
    label: "Custom Actions",
    tab: "actions",
    settingKey: "custom-actions-section",
    keywords: ["custom", "action", "actions", "tool", "prompt", "rewrite"],
  },
  {
    label: "Beta Releases",
    tab: "about",
    settingKey: "beta-releases",
    keywords: [
      "beta",
      "beta releases",
      "prerelease",
      "pre-release",
      "early access",
      "update channel",
      "channel",
    ],
  },
  {
    label: "Send Feedback",
    tab: "about",
    settingKey: "feedback-link",
    keywords: [
      "feedback",
      "send feedback",
      "report",
      "issue",
      "bug",
      "contact",
      "form",
      "tally",
    ],
  },
  {
    label: "About & Feedback",
    tab: "about",
    settingKey: "about-section",
    keywords: [
      "about",
      "update",
      "version",
      "github",
      "website",
      "links",
      "privacy",
    ],
  },
  {
    label: "Typography Preset",
    tab: "appearance",
    settingKey: "typography-preset",
    keywords: [
      "typography",
      "preset",
      "font",
      "fonts",
      "serif",
      "sans",
      "monospace",
      "editorial",
      "modern",
      "typeface",
    ],
  },
  {
    label: "Paper Texture",
    tab: "appearance",
    settingKey: "paper-texture",
    keywords: [
      "paper",
      "texture",
      "background",
      "page",
      "cream",
      "linen",
      "newsprint",
      "dark",
      "surround",
      "grain",
    ],
  },
  {
    label: "Reading Mode",
    tab: "appearance",
    settingKey: "reading-mode",
    keywords: [
      "reading",
      "mode",
      "bionic",
      "dyslexic",
      "open dyslexic",
      "accessibility",
      "emphasis",
    ],
  },
];

function formatTimestamp(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toolLabel(name) {
  if (!name) return "AI Tool";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function snippet(text, max = 120) {
  if (!text) return "";
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function Settings({
  open,
  language,
  onLanguageChange,
  fontSize,
  onFontSizeChange,
  lineSpacing,
  onLineSpacingChange,
  focusMode,
  onFocusModeChange,
  proseScanEnabled,
  onProseScanChange,
  betaOptIn,
  onBetaOptInChange,
  docxAuthor,
  onDocxAuthorChange,
  typographyPreset,
  onTypographyPresetChange,
  paperTexture,
  onPaperTextureChange,
  readingMode,
  onReadingModeChange,
  onResetDefaults,
  onCheckForUpdates,
  updateState,
  onClose,
  focusSettingKey = null,
  onFocusSettingConsumed,
  userDictionary,
  onAddWord,
  onRemoveWord,
  documentHistory,
  transformHistory,
  autoDraftMode,
  onAutoDraftModeChange,
  onManualSave,
  onRestoreDraft,
  onReapplyTransform,
  onToggleDraftLock,
  onToggleTransformLock,
  onClearDrafts,
  onClearTransforms,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const isDefault =
    language === SETTINGS_DEFAULTS.language &&
    fontSize === SETTINGS_DEFAULTS.fontSize &&
    focusMode === SETTINGS_DEFAULTS.focusMode &&
    lineSpacing === SETTINGS_DEFAULTS.lineSpacing &&
    proseScanEnabled === SETTINGS_DEFAULTS.proseScanEnabled &&
    typographyPreset === SETTINGS_DEFAULTS.typographyPreset &&
    paperTexture === SETTINGS_DEFAULTS.paperTexture &&
    readingMode === SETTINGS_DEFAULTS.readingMode;

  const updateBusy = ["checking", "installing"].includes(updateState?.status);
  const updateButtonLabel =
    updateState?.status === "checking"
      ? "Checking…"
      : updateState?.status === "installing"
        ? "Installing…"
        : "Check for updates";

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [activeTab]);

  // ── Dictionary tab local state ──────────────────────────────────────
  const [dictNewWord, setDictNewWord] = useState("");
  const [dictQuery, setDictQuery] = useState("");
  const [dictNotice, setDictNotice] = useState("");
  const dictInputRef = useRef(null);
  const [historyTab, setHistoryTab] = useState("drafts");
  const [histQuery, setHistQuery] = useState("");
  const [histCopiedId, setHistCopiedId] = useState(null);
  const histCopiedTimerRef = useRef(null);

  useEffect(() => {
    if (activeTab !== "dictionary") return;
    const id = window.requestAnimationFrame(() =>
      dictInputRef.current?.focus()
    );
    return () => window.cancelAnimationFrame(id);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "history") {
      setHistQuery("");
      setHistCopiedId(null);
      if (histCopiedTimerRef.current) {
        clearTimeout(histCopiedTimerRef.current);
        histCopiedTimerRef.current = null;
      }
    }
  }, [activeTab]);

  const visibleWords = (() => {
    const q = dictQuery.trim().toLowerCase();
    if (!q) return userDictionary;
    return userDictionary.filter((w) => w.toLowerCase().includes(q));
  })();

  const filteredDocs = (() => {
    const q = histQuery.trim().toLowerCase();
    if (!q) return documentHistory;
    return documentHistory.filter((d) => d.text.toLowerCase().includes(q));
  })();

  const filteredTransforms = (() => {
    const q = histQuery.trim().toLowerCase();
    if (!q) return transformHistory;
    return transformHistory.filter(
      (t) =>
        t.tool.toLowerCase().includes(q) ||
        t.sourceText.toLowerCase().includes(q) ||
        t.resultText.toLowerCase().includes(q)
    );
  })();

  function submitDictWord() {
    const word = dictNewWord.trim();
    if (!word) return;
    const result = onAddWord(word);
    if (result === "duplicate") {
      setDictNotice(`"${word}" is already in your dictionary.`);
    } else {
      setDictNotice("");
    }
    setDictNewWord("");
    dictInputRef.current?.focus();
  }

  function handleHistCopy(text, id) {
    navigator.clipboard.writeText(text);
    setHistCopiedId(id);
    if (histCopiedTimerRef.current) {
      clearTimeout(histCopiedTimerRef.current);
    }
    histCopiedTimerRef.current = setTimeout(() => {
      setHistCopiedId(null);
      histCopiedTimerRef.current = null;
    }, 1500);
  }

  const hasDrafts = documentHistory.length > 0;
  const hasTransforms = transformHistory.length > 0;
  const hasAny = hasDrafts || hasTransforms;

  const [highlightedKey, setHighlightedKey] = useState(null);
  const highlightTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Deep-link from outside Settings (e.g. header language button → Language).
  useEffect(() => {
    if (!open || !focusSettingKey) return;
    const item = SEARCH_INDEX.find((entry) => entry.settingKey === focusSettingKey);
    setActiveTab(item?.tab || "general");
    setHighlightedKey(focusSettingKey);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedKey(null);
      highlightTimerRef.current = null;
    }, 2000);
    onFocusSettingConsumed?.();
  }, [open, focusSettingKey, onFocusSettingConsumed]);

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    // Build shortcut search items dynamically
    const shortcutItems = SHORTCUTS.map((s) => ({
      label: s.action,
      tab: "shortcuts",
      settingKey: `shortcut-${s.action.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      keywords: [s.action.toLowerCase(), ...s.keys.map((k) => k.toLowerCase())],
    }));

    const allItems = [
      // Index items linking to specific settings
      ...SEARCH_INDEX,
      // Shortcut items
      ...shortcutItems,
    ];

    const matched = [];
    function itemMatchesQuery(item, query) {
      const label = item.label.toLowerCase();
      if (label.includes(query)) return true;
      if (item.keywords.some((k) => k.includes(query))) return true;
      // Multi-word queries: "send feedback" matches label/keywords that
      // cover each word even when no single keyword equals the full phrase.
      const haystack = [label, ...item.keywords].join(" ");
      const words = query.split(/\s+/).filter(Boolean);
      return words.length > 1 && words.every((word) => haystack.includes(word));
    }
    // Prefer specific setting keyword matches first so a query like
    // "feedback" lands on the feedback link, not the About tab / beta block.
    for (const item of allItems) {
      if (matched.length >= 8) break;
      if (matched.some((m) => m.tab === item.tab && m.label === item.label))
        continue;
      if (itemMatchesQuery(item, q)) {
        matched.push({
          label: item.label,
          tab: item.tab,
          settingKey: item.settingKey,
        });
      }
    }
    // Tab labels only when that tab has no stronger keyword hit yet.
    for (const tab of TABS) {
      if (matched.length >= 8) break;
      if (!tab.label.toLowerCase().includes(q)) continue;
      if (matched.some((m) => m.tab === tab.id)) continue;
      matched.push({
        label: tab.label,
        tab: tab.id,
        settingKey: `${tab.id}-section`,
      });
    }
    // Deduplicate by label
    const seen = new Set();
    return matched.filter((m) => {
      if (seen.has(m.label)) return false;
      seen.add(m.label);
      return true;
    });
  })();

  function handleSearchSelect(id, settingKey) {
    setActiveTab(id);
    setSearchQuery("");
    setSearchFocused(false);
    searchRef.current?.blur();

    if (settingKey) {
      setHighlightedKey(settingKey);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedKey(null);
        highlightTimerRef.current = null;
      }, 2000);
    }
  }

  useEffect(() => {
    if (!highlightedKey) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(
        `[data-setting-key="${highlightedKey}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightedKey, activeTab]);

  function getHighlightClass(key) {
    const isHighlighted = highlightedKey === key;
    return (
      "px-3 py-2 rounded-lg -mx-3 transition-all duration-1000 " +
      (isHighlighted
        ? "bg-[rgba(31,108,159,0.22)] ring-2 ring-[rgba(31,108,159,0.5)] shadow-sm"
        : "bg-transparent ring-0 ring-transparent")
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-md px-4 transition-all duration-200"
      style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[646px] max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <p id="settings-title" className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Settings
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Close settings"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <nav className="flex w-44 shrink-0 flex-col overflow-visible border-r border-hairline">
            {/* Search */}
            <div className="border-b border-hairline px-2 py-2.5">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  weight="bold"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search settings…"
                  aria-label="Search settings"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      searchRef.current?.blur();
                    }
                    if (e.key === "Enter" && searchResults.length > 0) {
                      handleSearchSelect(
                        searchResults[0].tab,
                        searchResults[0].settingKey
                      );
                    }
                  }}
                  className="w-full rounded-lg border border-hairline bg-canvas py-1.5 pl-8 pr-2 font-sans text-xs text-ink placeholder-muted outline-none transition-colors focus:border-pale-blue-text"
                />
                {searchFocused &&
                  searchQuery.trim() &&
                  searchResults.length > 0 && (
                    <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[280px] overflow-hidden rounded-lg border border-hairline bg-white shadow-lg">
                      {searchResults.map(({ label, tab, settingKey }) => {
                        const tabDef = TABS.find((t) => t.id === tab);
                        const Icon = tabDef?.icon || MagnifyingGlass;
                        return (
                          <button
                            key={`${tab}-${label}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSearchSelect(tab, settingKey);
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left font-sans text-sm text-ink transition-colors hover:bg-hairline/50"
                          >
                            <Icon
                              size={16}
                              weight="regular"
                              className="text-muted"
                            />
                            <span className="flex-1">{label}</span>
                            <span className="font-sans text-[10px] text-muted">
                              {tabDef?.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>

            <div className="flex flex-col gap-0.5 py-2 px-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-left font-sans text-xs transition-colors " +
                    (activeTab === id
                      ? "bg-[rgba(31,108,159,0.15)] font-medium text-ink"
                      : "text-muted hover:bg-hairline/50 hover:text-ink")
                  }
                >
                  <Icon
                    size={16}
                    weight={activeTab === id ? "fill" : "regular"}
                  />
                  {label}
                </button>
              ))}
            </div>

            <div
              data-setting-key="reset-defaults"
              className={`mt-auto border-t border-hairline px-2 py-3 ${getHighlightClass("reset-defaults")}`}
            >
              <button
                type="button"
                onClick={onResetDefaults}
                disabled={isDefault}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 font-sans text-xs text-muted transition-colors hover:bg-hairline/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowCounterClockwise size={14} weight="bold" />
                Reset to Default
              </button>
            </div>
          </nav>

          {/* Right pane */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Active Panel */}
            <div
              ref={panelRef}
              className={
                "lex-scroll min-h-0 flex-1 pt-6 px-8 pb-8 " +
                (activeTab === "actions"
                  ? "flex flex-col overflow-hidden"
                  : "overflow-y-auto")
              }
            >
              {/* ── General ── */}
              {activeTab === "general" && (
                <div className="space-y-2.5">
                  <h2 className="font-serif text-xl font-bold text-ink pb-1">
                    General
                  </h2>

                  <div
                    data-setting-key="language"
                    className={getHighlightClass("language")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Language
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Sets the spelling and grammar rules used when
                      proofreading.
                    </p>
                    <div className="mt-3">
                      <LanguageDropdown
                        options={LANGUAGES}
                        value={language}
                        onChange={onLanguageChange}
                      />
                    </div>
                  </div>

                  <div
                    data-setting-key="focus-mode"
                    className={`flex items-start justify-between gap-4 ${getHighlightClass("focus-mode")}`}
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                        Focus Mode
                      </p>
                      <p className="mt-1 font-sans text-xs text-muted">
                        Collapses both side panels for a distraction-free
                        writing view. Hover a screen-edge rail to peek a panel
                        open; it auto-closes when you move away.
                      </p>
                    </div>
                    <div className="pt-0.5">
                      <Toggle
                        checked={focusMode}
                        onChange={onFocusModeChange}
                        label="Toggle focus mode"
                      />
                    </div>
                  </div>

                  <div
                    data-setting-key="prose-scan"
                    className={`flex items-start justify-between gap-4 ${getHighlightClass("prose-scan")}`}
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                        Scan Prose &amp; Style
                      </p>
                      <p className="mt-1 font-sans text-xs text-muted">
                        Detects passive voice, wordy phrases, and repetitive
                        sentence openers. Turn off to avoid subjective style
                        flags in clean copy.
                      </p>
                    </div>
                    <div className="pt-0.5">
                      <Toggle
                        checked={proseScanEnabled}
                        onChange={onProseScanChange}
                        label="Toggle prose and style scanning"
                      />
                    </div>
                  </div>

                  <div
                    data-setting-key="font-size"
                    className={getHighlightClass("font-size")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Font Size
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Scales the text in the editor for comfortable reading.
                    </p>
                    <div className="relative isolate mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-pale-blue transition-transform duration-200 ease-out"
                        style={{
                          width: `${100 / FONT_SIZES.length}%`,
                          transform: `translateX(${FONT_SIZES.indexOf(fontSize) * 100}%)`,
                        }}
                      />
                      {FONT_SIZES.map((size, i) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => onFontSizeChange(size)}
                          className={
                            "relative z-10 flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                            (i > 0 ? "border-l border-hairline " : "") +
                            (fontSize === size
                              ? "text-ink"
                              : "bg-transparent text-muted hover:text-ink")
                          }
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    data-setting-key="line-spacing"
                    className={getHighlightClass("line-spacing")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Line Spacing
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Adjust text row height for layout readability.
                    </p>
                    <div className="relative isolate mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-pale-blue transition-transform duration-200 ease-out"
                        style={{
                          width: `${100 / LINE_SPACINGS.length}%`,
                          transform: `translateX(${LINE_SPACINGS.findIndex((o) => o.value === lineSpacing) * 100}%)`,
                        }}
                      />
                      {LINE_SPACINGS.map((option, i) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onLineSpacingChange(option.value)}
                          className={
                            "relative z-10 flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                            (i > 0 ? "border-l border-hairline " : "") +
                            (lineSpacing === option.value
                              ? "text-ink"
                              : "bg-transparent text-muted hover:text-ink")
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-2">
                    <span className="h-px flex-1 bg-hairline" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Export
                    </span>
                    <span className="h-px flex-1 bg-hairline" />
                  </div>

                  <div
                    data-setting-key="docx-author"
                    className={getHighlightClass("docx-author")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Default Author / Reviewer Name
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Pre-fills the tracked-suggestions author for DOCX exports.
                      Word shows this name next to every redline. Leave blank to
                      export without a reviewer name.
                    </p>
                    <input
                      type="text"
                      value={docxAuthor}
                      onChange={(event) =>
                        onDocxAuthorChange(event.target.value)
                      }
                      placeholder="Lex"
                      aria-label="Default author / reviewer name"
                      className="mt-3 w-full rounded border border-hairline bg-canvas px-3 py-2 font-sans text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-muted"
                    />
                  </div>
                </div>
              )}

              {/* ── Appearance ── */}
              {activeTab === "appearance" && (
                <div className="space-y-2.5">
                  <h2 className="font-serif text-xl font-bold text-ink pb-1">
                    Appearance
                  </h2>

                  <div
                    data-setting-key="typography-preset"
                    className={getHighlightClass("typography-preset")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Typography Preset
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Body and heading fonts for the editor. Screen only;
                      print and PDF exports keep their own themes.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {TYPOGRAPHY_PRESETS.map((preset) => {
                        const active = typographyPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => onTypographyPresetChange(preset.id)}
                            className={
                              "rounded-xl border px-4 py-2.5 text-left transition-colors " +
                              (active
                                ? "border-ink bg-white ring-1 ring-ink"
                                : "border-hairline bg-white hover:border-muted")
                            }
                          >
                            <span
                              className="block font-sans text-sm font-medium text-ink"
                              style={{
                                fontFamily: preset.bodyFontStack.join(", "),
                              }}
                            >
                              {preset.label}
                            </span>
                            <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted">
                              {preset.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    data-setting-key="paper-texture"
                    className={getHighlightClass("paper-texture")}
                  >
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                      Paper Texture
                      <span className="rounded border border-hairline px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-muted">
                        Beta
                      </span>
                      <span className="group relative inline-flex normal-case tracking-normal">
                        <Info
                          size={12}
                          weight="bold"
                          className="text-muted"
                          aria-label="Paper texture beta info"
                        />
                        <span className="pointer-events-none absolute left-0 top-5 z-20 w-56 rounded-md border border-hairline bg-white p-2.5 font-sans text-[11px] leading-relaxed text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                          Paper textures are in beta and some edge cases may
                          remain. If you find one, please take a screenshot and
                          send it through the feedback form.
                        </span>
                      </span>
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Paper texture (page + surround, designed pairs). Screen
                      only. Exports always print on a plain white page.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {PAPER_TEXTURES.map((texture) => {
                        const active = paperTexture === texture.id;
                        return (
                          <button
                            key={texture.id}
                            type="button"
                            onClick={() => onPaperTextureChange(texture.id)}
                            className={
                              "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors " +
                              (active
                                ? "border-ink bg-white ring-1 ring-ink"
                                : "border-hairline bg-white hover:border-muted")
                            }
                          >
                            <span>
                              <span className="block font-sans text-sm font-medium text-ink">
                                {texture.label}
                              </span>
                              <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted">
                                Page{" "}
                                <span className="font-mono">
                                  {texture.pageColor}
                                </span>{" "}
                                · Surround{" "}
                                <span className="font-mono">
                                  {texture.surroundColor}
                                </span>
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <span
                                className="h-4 w-4 rounded border border-hairline"
                                style={{ backgroundColor: texture.pageColor }}
                                title={`Page ${texture.pageColor}`}
                              />
                              <span
                                className="h-4 w-4 rounded border border-hairline"
                                style={{ backgroundColor: texture.surroundColor }}
                                title={`Surround ${texture.surroundColor}`}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    data-setting-key="reading-mode"
                    className={getHighlightClass("reading-mode")}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Reading Mode
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Choose how text appears while you read: plain text,
                      bold word starts (Bionic), or the OpenDyslexic typeface.
                    </p>
                    <div className="relative isolate mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-pale-blue transition-transform duration-200 ease-out"
                        style={{
                          width: `${100 / READING_MODES.length}%`,
                          transform: `translateX(${READING_MODES.findIndex((o) => o.id === readingMode) * 100}%)`,
                        }}
                      />
                      {READING_MODES.map((option, i) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onReadingModeChange(option.id)}
                          className={
                            "relative z-10 flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                            (i > 0 ? "border-l border-hairline " : "") +
                            (readingMode === option.id
                              ? "text-ink"
                              : "bg-transparent text-muted hover:text-ink")
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Your Dictionary ── */}
              {activeTab === "dictionary" && (
                <div
                  data-setting-key="dictionary-section"
                  className={`space-y-5 ${getHighlightClass("dictionary-section")}`}
                >
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Your Dictionary
                  </h2>

                  <div>
                    <p className="font-sans text-xs text-muted">
                      Words you add are ignored by proofreading. Add or remove
                      words below; changes apply to the next check.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        ref={dictInputRef}
                        type="text"
                        value={dictNewWord}
                        onChange={(event) => {
                          setDictNewWord(event.target.value);
                          if (dictNotice) setDictNotice("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitDictWord();
                          }
                        }}
                        placeholder="Add a word…"
                        aria-label="Add a word to the dictionary"
                        className="min-w-0 flex-1 rounded border border-hairline bg-canvas px-3 py-2 font-sans text-sm text-ink outline-none focus:border-muted"
                      />
                      <button
                        type="button"
                        onClick={submitDictWord}
                        aria-label="Add word to dictionary"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-hairline bg-canvas text-muted transition-colors hover:border-muted hover:text-ink"
                      >
                        <Plus size={16} weight="bold" />
                      </button>
                    </div>
                    {dictNotice && (
                      <p className="mt-2 font-sans text-xs text-muted">
                        {dictNotice}
                      </p>
                    )}
                  </div>

                  <div>
                    {userDictionary.length === 0 ? (
                      <p className="font-sans text-sm text-muted">
                        No words added yet.
                      </p>
                    ) : (
                      <>
                        <div className="relative mb-3">
                          <MagnifyingGlass
                            size={14}
                            weight="bold"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                          />
                          <input
                            type="text"
                            value={dictQuery}
                            onChange={(event) =>
                              setDictQuery(event.target.value)
                            }
                            placeholder="Filter words…"
                            aria-label="Filter words"
                            className="w-full rounded border border-hairline bg-canvas py-2 pl-8 pr-3 font-sans text-sm text-ink outline-none focus:border-muted"
                          />
                        </div>
                        {visibleWords.length === 0 ? (
                          <p className="font-sans text-sm text-muted">
                            No matches.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {visibleWords.map((word) => (
                              <li
                                key={word}
                                className="flex items-center justify-between gap-2 rounded border border-hairline bg-canvas px-3 py-2"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <BookBookmark
                                    size={14}
                                    weight="bold"
                                    className="shrink-0 text-muted"
                                  />
                                  <span className="truncate font-sans text-sm text-ink">
                                    {word}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onRemoveWord(word)}
                                  aria-label={`Remove ${word} from dictionary`}
                                  className="shrink-0 rounded p-1 text-muted transition-colors hover:text-red-600"
                                >
                                  <Trash size={15} weight="bold" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── History & Drafts ── */}
              {activeTab === "history" && (
                <div
                  data-setting-key="history-section"
                  className={`flex h-full flex-col ${getHighlightClass("history-section")}`}
                >
                  <h2 className="font-serif text-xl font-bold text-ink">
                    History &amp; Drafts
                  </h2>

                  <div className="mt-4 flex items-center gap-4 border-b border-hairline pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryTab("drafts");
                        setHistQuery("");
                      }}
                      className={
                        "font-mono text-[10px] uppercase tracking-wider transition-colors " +
                        (historyTab === "drafts"
                          ? "font-semibold text-ink"
                          : "text-muted hover:text-ink")
                      }
                    >
                      Draft Snapshots
                      {hasDrafts > 0 && (
                        <span className="ml-1.5 rounded-full bg-hairline px-1.5 py-0.5 text-[10px] text-muted">
                          {documentHistory.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryTab("transforms");
                        setHistQuery("");
                      }}
                      className={
                        "font-mono text-[10px] uppercase tracking-wider transition-colors " +
                        (historyTab === "transforms"
                          ? "font-semibold text-ink"
                          : "text-muted hover:text-ink")
                      }
                    >
                      AI Generations
                      {hasTransforms > 0 && (
                        <span className="ml-1.5 rounded-full bg-hairline px-1.5 py-0.5 text-[10px] text-muted">
                          {transformHistory.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {historyTab === "drafts" && (
                    <div className="flex items-center gap-2 border-b border-hairline py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                          Auto-save
                        </span>
                        <Toggle
                          checked={autoDraftMode}
                          onChange={onAutoDraftModeChange}
                          label="Toggle auto-save drafts"
                        />
                      </div>
                      <div className="relative group">
                        <Info
                          size={14}
                          weight="bold"
                          className="text-muted cursor-help"
                        />
                        <div className="pointer-events-none absolute left-0 top-6 z-10 w-56 rounded-lg border border-hairline bg-white px-3 py-2 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="font-sans text-[11px] leading-snug text-ink">
                            <strong>Auto:</strong> saves 3 seconds after you
                            stop typing.
                          </p>
                          <p className="mt-1 font-sans text-[11px] leading-snug text-ink">
                            <strong>Manual:</strong> only saves when you click
                            &ldquo;Save Draft.&rdquo;
                          </p>
                          <p className="mt-1 font-sans text-[11px] leading-snug text-muted">
                            A maximum of 20 save points is kept at any time.
                          </p>
                        </div>
                      </div>
                      {!autoDraftMode && (
                        <button
                          type="button"
                          onClick={onManualSave}
                          className="ml-auto flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                          aria-label="Save current draft"
                        >
                          <FloppyDisk size={12} weight="bold" />
                          Save Draft
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-b border-hairline py-2.5">
                    <div className="relative flex-1">
                      <MagnifyingGlass
                        size={14}
                        weight="bold"
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        type="text"
                        value={histQuery}
                        onChange={(e) => setHistQuery(e.target.value)}
                        placeholder={
                          historyTab === "drafts"
                            ? "Search drafts…"
                            : "Search generations…"
                        }
                        aria-label="Search history"
                        className="w-full rounded border border-hairline bg-canvas py-1.5 pl-8 pr-3 font-sans text-xs text-ink outline-none focus:border-muted"
                      />
                    </div>
                    {hasAny && (
                      <button
                        type="button"
                        onClick={() => {
                          if (historyTab === "drafts") onClearDrafts();
                          else onClearTransforms();
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1.5 font-sans text-xs text-muted transition-colors hover:text-red-600"
                        aria-label="Clear history"
                      >
                        <Trash size={13} weight="bold" />
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="lex-scroll min-h-0 flex-1 overflow-y-auto pt-3">
                    {historyTab === "drafts" && (
                      <>
                        {!hasDrafts ? (
                          <div className="flex flex-col items-center gap-2 py-8 text-muted">
                            <FileText size={28} weight="thin" />
                            <p className="font-sans text-sm">
                              No draft snapshots yet.
                            </p>
                            <p className="font-sans text-xs">
                              {autoDraftMode
                                ? "Drafts are auto-saved 3 seconds after you stop typing."
                                : 'Click "Save Draft" above to save the current document.'}
                            </p>
                          </div>
                        ) : filteredDocs.length === 0 ? (
                          <p className="py-6 text-center font-sans text-sm text-muted">
                            No drafts match your search.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {filteredDocs.map((draft) => (
                              <div
                                key={draft.id}
                                className="rounded-lg border border-hairline bg-canvas p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 font-sans text-xs text-ink">
                                      <ClockCounterClockwise
                                        size={12}
                                        weight="bold"
                                        className="shrink-0 text-muted"
                                      />
                                      {formatTimestamp(draft.timestamp)}
                                    </p>
                                    <p className="mt-0.5 font-sans text-[11px] text-muted">
                                      {draft.wordCount}{" "}
                                      {draft.wordCount === 1 ? "word" : "words"}
                                      {" · "}
                                      {draft.charCount}{" "}
                                      {draft.charCount === 1 ? "char" : "chars"}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onRestoreDraft(draft)}
                                      className="flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                                      aria-label="Restore this draft"
                                      title="Restore (replaces current document)"
                                    >
                                      <ArrowCounterClockwise
                                        size={12}
                                        weight="bold"
                                      />
                                      Restore
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleHistCopy(draft.text, draft.id)
                                      }
                                      className={
                                        "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                                        (histCopiedId === draft.id
                                          ? "border-green-400 bg-green-50 text-green-700"
                                          : "border-hairline bg-white text-ink hover:bg-hairline/60")
                                      }
                                      aria-label="Copy draft text"
                                      title="Copy to clipboard"
                                    >
                                      {histCopiedId === draft.id ? (
                                        <Check size={12} weight="bold" />
                                      ) : (
                                        <Copy size={12} weight="bold" />
                                      )}
                                      {histCopiedId === draft.id
                                        ? "Copied"
                                        : "Copy"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleDraftLock(draft.id)
                                      }
                                      className={
                                        "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                                        (draft.locked
                                          ? "border-pale-green-text/20 bg-pale-green text-pale-green-text"
                                          : "border-hairline bg-white text-muted hover:text-ink")
                                      }
                                      aria-label={
                                        draft.locked
                                          ? "Unlock this draft"
                                          : "Lock this draft"
                                      }
                                      title={
                                        draft.locked
                                          ? "Locked — survives clear and cap"
                                          : "Lock to protect from clear and cap"
                                      }
                                    >
                                      {draft.locked ? (
                                        <LockSimple size={12} weight="fill" />
                                      ) : (
                                        <LockSimpleOpen
                                          size={12}
                                          weight="bold"
                                        />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-1.5 line-clamp-2 font-sans text-[11px] leading-snug text-muted">
                                  {snippet(draft.text, 200)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {historyTab === "transforms" && (
                      <>
                        {!hasTransforms ? (
                          <div className="flex flex-col items-center gap-2 py-8 text-muted">
                            <Robot size={28} weight="thin" />
                            <p className="font-sans text-sm">
                              No AI generations yet.
                            </p>
                            <p className="font-sans text-xs">
                              Use Rewrite, Tone, or other AI tools and results
                              will appear here.
                            </p>
                          </div>
                        ) : filteredTransforms.length === 0 ? (
                          <p className="py-6 text-center font-sans text-sm text-muted">
                            No generations match your search.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {filteredTransforms.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-lg border border-hairline bg-canvas p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <span className="inline-block rounded bg-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                                      {toolLabel(entry.tool)}
                                    </span>
                                    <p className="mt-1 flex items-center gap-1.5 font-sans text-[11px] text-muted">
                                      <ClockCounterClockwise
                                        size={11}
                                        weight="bold"
                                        className="shrink-0"
                                      />
                                      {formatTimestamp(entry.timestamp)}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onReapplyTransform(entry)}
                                      className="flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                                      aria-label="Re-apply to editor"
                                      title="Re-apply to editor"
                                    >
                                      <ArrowCounterClockwise
                                        size={12}
                                        weight="bold"
                                      />
                                      Apply
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleHistCopy(
                                          entry.resultText,
                                          entry.id
                                        )
                                      }
                                      className={
                                        "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                                        (histCopiedId === entry.id
                                          ? "border-green-400 bg-green-50 text-green-700"
                                          : "border-hairline bg-white text-ink hover:bg-hairline/60")
                                      }
                                      aria-label="Copy output"
                                      title="Copy to clipboard"
                                    >
                                      {histCopiedId === entry.id ? (
                                        <Check size={12} weight="bold" />
                                      ) : (
                                        <Copy size={12} weight="bold" />
                                      )}
                                      {histCopiedId === entry.id
                                        ? "Copied"
                                        : "Copy"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleTransformLock(entry.id)
                                      }
                                      className={
                                        "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                                        (entry.locked
                                          ? "border-pale-green-text/20 bg-pale-green text-pale-green-text"
                                          : "border-hairline bg-white text-muted hover:text-ink")
                                      }
                                      aria-label={
                                        entry.locked
                                          ? "Unlock this generation"
                                          : "Lock this generation"
                                      }
                                      title={
                                        entry.locked
                                          ? "Locked — survives clear and cap"
                                          : "Lock to protect from clear and cap"
                                      }
                                    >
                                      {entry.locked ? (
                                        <LockSimple size={12} weight="fill" />
                                      ) : (
                                        <LockSimpleOpen
                                          size={12}
                                          weight="bold"
                                        />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                                      Input
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-muted">
                                      {snippet(entry.sourceText, 100)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                                      Output
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-ink">
                                      {snippet(entry.resultText, 100)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Lex's Engine ── */}
              {activeTab === "ai" && (
                <div
                  data-setting-key="lex-engine-section"
                  className={getHighlightClass("lex-engine-section")}
                >
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Lex's Engine
                  </h2>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-muted">
                    Lex's Model
                  </p>
                  <p className="mt-1 font-sans text-xs text-muted">
                    Runs entirely on your device. Download a local AI model or
                    use your own Ollama server. Your selection is saved and used
                    until changed.
                  </p>
                  <div className="mt-3">
                    <ModelManager
                      mode="settings"
                      onPreferenceChange={(pref) => {
                        setAiPreference(
                          pref.backend,
                          pref.model_key,
                          pref.ollama_model || ""
                        ).catch(() => {});
                      }}
                      onConfigured={() =>
                        window.dispatchEvent(
                          new CustomEvent("lexicon:ai-configured")
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {/* ── Custom Actions ── */}
              {activeTab === "actions" && (
                <div
                  data-setting-key="custom-actions-section"
                  className={`flex min-h-0 flex-1 flex-col ${getHighlightClass("custom-actions-section")}`}
                >
                  <h2 className="font-serif text-xl font-bold text-ink shrink-0 pb-3">
                    Custom Actions
                  </h2>
                  <CustomToolsSettings />
                </div>
              )}

              {/* ── Shortcuts ── */}
              {activeTab === "shortcuts" && (
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Shortcuts
                  </h2>
                  <p className="mt-3 font-sans text-xs text-muted">
                    All available commands and their key bindings.
                  </p>
                  <div className="mt-5">
                    {SHORTCUTS.map((shortcut) => {
                      const key = `shortcut-${shortcut.action.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                      return (
                        <div
                          key={shortcut.action}
                          data-setting-key={key}
                          className={
                            "flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0 " +
                            getHighlightClass(key)
                          }
                        >
                          <span className="font-mono text-xs text-ink">
                            {shortcut.action}
                          </span>
                          <span className="flex items-center gap-1">
                            {shortcut.keys.map((keyStr, i) => (
                              <span
                                key={keyStr}
                                className="flex items-center gap-1"
                              >
                                {i > 0 && (
                                  <span className="text-[10px] text-muted">
                                    +
                                  </span>
                                )}
                                <kbd className="lex-kbd">{keyStr}</kbd>
                              </span>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── About & Feedback ── */}
              {activeTab === "about" && (
                <div
                  data-setting-key="about-section"
                  className={`space-y-4 ${getHighlightClass("about-section")}`}
                >
                  <h2 className="font-serif text-xl font-bold text-ink">
                    About &amp; Feedback
                  </h2>

                  <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Updates
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      Check for new releases and install them without returning
                      to GitHub.
                    </p>
                    <button
                      type="button"
                      onClick={onCheckForUpdates}
                      disabled={updateBusy}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-hairline bg-white py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted disabled:cursor-wait disabled:opacity-60"
                    >
                      <ArrowCounterClockwise
                        size={16}
                        weight="bold"
                        className={updateBusy ? "animate-spin" : ""}
                      />
                      {updateButtonLabel}
                    </button>
                    {updateState?.message && (
                      <p
                        className={
                          "mt-2 text-center font-sans text-[11px] " +
                          (updateState.status === "error"
                            ? "text-red-600"
                            : "text-muted")
                        }
                      >
                        {updateState.message}
                      </p>
                    )}
                    <div
                      data-setting-key="beta-releases"
                      className={`mt-4 flex items-start justify-between gap-4 border-t border-hairline pt-3.5 ${getHighlightClass("beta-releases")}`}
                    >
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                          Beta Releases
                        </p>
                        <p className="mt-1 font-sans text-xs text-muted">
                          Receive pre-release builds before they ship to
                          everyone. You may encounter rough edges. Switch back
                          any time; updates only move forward, so you stay on
                          beta until the next stable release is newer.
                        </p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <Toggle
                          checked={betaOptIn}
                          onChange={onBetaOptInChange}
                          label="Toggle beta releases"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      Links
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        openExternalUrl("https://lexicon-writer.pages.dev/")
                      }
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded border border-hairline bg-white py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted hover:bg-hairline/40"
                    >
                      <LexiconLogo size={16} />
                      Visit the Lexicon website
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternalUrl(GITHUB_URL)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-hairline bg-white py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted hover:bg-hairline/40"
                    >
                      <GithubLogo size={16} weight="bold" />
                      View source on GitHub
                    </button>
                    <div
                      data-setting-key="feedback-link"
                      className={`mt-1.5 ${getHighlightClass("feedback-link")}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openExternalUrl("https://tally.so/r/LZq8vy")
                        }
                        className={
                          betaOptIn
                            ? "flex w-full items-center justify-center gap-2 rounded-md border border-[#DDD6FE] bg-[#F5F3FF] py-2 font-sans text-xs font-semibold text-[#6D28D9] shadow-sm transition-colors hover:border-[#C4B5FD] hover:bg-[#EDE9FE]"
                            : "flex w-full items-center justify-center gap-2 rounded border border-hairline bg-white py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted hover:bg-hairline/40"
                        }
                      >
                        <PaperPlaneTilt
                          size={betaOptIn ? 14 : 16}
                          weight="bold"
                          className={betaOptIn ? "text-[#6D28D9]" : ""}
                        />
                        <span>Send feedback or report an issue</span>
                        {betaOptIn && (
                          <span className="ml-1 rounded bg-[#DDD6FE] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#5B21B6]">
                            Beta Tester
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        size={18}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-pale-blue-text"
                      />
                      <div>
                        <p className="font-sans text-sm font-semibold text-ink">
                          Offline by design
                        </p>
                        <p className="mt-0.5 font-sans text-xs leading-relaxed text-muted">
                          Your words stay entirely on this machine. Every
                          proofread, rewrite, and draft is processed locally.
                          Nothing is uploaded to any cloud server.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
