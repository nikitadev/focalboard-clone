const Permission = {
  ManageBoardType: "manage_board_type",
  DeleteBoard: "delete_board",
  ShareBoard: "share_board",
  ManageBoardRoles: "manage_board_roles",
  ManageBoardCards: "manage_board_cards",
  ManageBoardProperties: "manage_board_properties",
  CommentBoardCards: "comment_board_cards",
  ViewBoard: "view_board",
  DeleteOthersComments: "delete_others_comments",
};

class Constants {
  static menuColors = {
    propColorDefault: "Default",
    propColorGray: "Gray",
    propColorBrown: "Brown",
    propColorOrange: "Orange",
    propColorYellow: "Yellow",
    propColorGreen: "Green",
    propColorBlue: "Blue",
    propColorPurple: "Purple",
    propColorPink: "Pink",
    propColorRed: "Red",
  };

  static minColumnWidth = 100;
  static defaultTitleColumnWidth = 280;
  static tableHeaderId = "__header";
  static tableCalculationId = "__calculation";
  static titleColumnId = "__title";
  static badgesColumnId = "__badges";

  static versionString = "7.8.0";
  static versionDisplayString = "Feb 2023";

  static archiveHelpPage =
    "https://docs.mattermost.com/boards/migrate-to-boards.html";
  static imports = [
    {
      id: "trello",
      displayName: "Trello",
      href: Constants.archiveHelpPage + "#import-from-trello",
    },
    {
      id: "asana",
      displayName: "Asana",
      href: Constants.archiveHelpPage + "#import-from-asana",
    },
    {
      id: "notion",
      displayName: "Notion",
      href: Constants.archiveHelpPage + "#import-from-notion",
    },
    {
      id: "jira",
      displayName: "Jira",
      href: Constants.archiveHelpPage + "#import-from-jira",
    },
    {
      id: "todoist",
      displayName: "Todoist",
      href: Constants.archiveHelpPage + "#import-from-todoist",
    },
  ];

  static languages = [
    {
      code: "en",
      name: "english",
      displayName: "English",
    },
    {
      code: "ru",
      name: "russian",
      displayName: "Русский",
    },
  ];

  static keyCodes = {
    COMPOSING: ["Composing", 229],
    ESC: ["Esc", 27],
    UP: ["Up", 38],
    DOWN: ["Down", 40],
    ENTER: ["Enter", 13],
    A: ["a", 65],
    B: ["b", 66],
    C: ["c", 67],
    D: ["d", 68],
    E: ["e", 69],
    F: ["f", 70],
    G: ["g", 71],
    H: ["h", 72],
    I: ["i", 73],
    J: ["j", 74],
    K: ["k", 75],
    L: ["l", 76],
    M: ["m", 77],
    N: ["n", 78],
    O: ["o", 79],
    P: ["p", 80],
    Q: ["q", 81],
    R: ["r", 82],
    S: ["s", 83],
    T: ["t", 84],
    U: ["u", 85],
    V: ["v", 86],
    W: ["w", 87],
    X: ["x", 88],
    Y: ["y", 89],
    Z: ["z", 90],
  };

  static globalTeamId = "0";

  static myInsights = "MY";

  static SystemUserID = "system";
}

export { Constants, Permission };
