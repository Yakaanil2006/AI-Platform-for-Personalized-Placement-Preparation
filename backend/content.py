CODING = {
    "coding-arrays": {
        "title": "Two Sum", "topic": "Arrays",
        "prompt": "Given a list of integers and a target, return the indices of two distinct values that add up to the target. Assume exactly one solution. Explain time and space complexity.",
        "example": "[2, 7, 11, 15], target 9 → [0, 1]",
    },
    "coding-trees": {
        "title": "Maximum Depth", "topic": "Trees",
        "prompt": "Given the root of a binary tree, return its maximum depth. An empty tree has depth zero. Explain time and space complexity.",
        "example": "A root with one leaf has depth 2.",
    },
    "coding-sql": {
        "title": "Group Order Totals", "topic": "SQL",
        "prompt": "Given records containing customer IDs and order amounts, return a mapping from customer ID to total order amount. Explain how the approach corresponds to SQL GROUP BY.",
        "example": "[(1, 5), (2, 3), (1, 7)] → {1: 12, 2: 3}",
    },
}
APTITUDE = [
    ("q1", "Quantitative", "What is 15% of 240?", ["24", "36", "42", "48"], 1, "Multiply 240 by 0.15."),
    ("q2", "Quantitative", "What is the mean of 4, 6, and 11?", ["6", "7", "8", "9"], 1, "Divide the sum, 21, by three."),
    ("q3", "Logical", "What comes next in 3, 6, 12, 24?", ["28", "36", "48", "60"], 2, "Each term is double the preceding term."),
    ("q4", "Logical", "All roses are flowers. Which statement must be true?", ["All flowers are roses", "Some roses are not flowers", "No roses are flowers", "Every rose is a flower"], 3, "The last statement restates the given relationship."),
    ("q5", "Verbal", "Choose the synonym of concise.", ["Brief", "Slow", "Vague", "Formal"], 0, "Concise describes something brief and clear."),
    ("q6", "Verbal", "Choose the correct sentence.", ["She go home.", "She goes home.", "She going home.", "She gone home."], 1, "A singular third-person subject takes goes."),
]
COMMUNICATION = "Describe a time you handled a difficult team project. Include the situation, your task, the action you took, and the result."
SAMPLE = {
    "title": "Software development interview walkthrough",
    "process": "An online assessment was followed by two technical rounds and a behavioral discussion.",
    "rounds": ["Online assessment on arrays and hash maps", "Technical round on binary tree traversal and SQL joins", "Behavioral interview about teamwork"],
    "questions": ["Find two values that sum to a target", "Compare breadth-first and depth-first traversal", "Explain an inner join and a left join"],
    "topics": ["Arrays", "Trees", "SQL", "Teamwork"],
    "difficulty": "medium",
    "tips": "Explain complexity, test edge cases, and use a specific teamwork story with a measurable outcome.",
}
