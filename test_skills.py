from dotenv import load_dotenv
from openai import OpenAI
import json

load_dotenv()

client = OpenAI()

with open("referral-copilot.md", "r", encoding="utf-8") as f:
    skill = f.read()


def evaluate_response(user_query: str, response_text: str):
    """
    Basic local evaluation checks.
    """

    checks = {
        "asked_clarifying_questions": "?" in response_text,
        "mentions_constraints": any(
            word in response_text.lower()
            for word in ["budget", "distance", "constraint", "preference"]
        ),
        "contains_source": any(
            word in response_text.lower()
            for word in ["source", "citation", "evidence", "retrieved"]
        ),
        "mentions_uncertainty": any(
            word in response_text.lower()
            for word in [
                "may",
                "might",
                "uncertain",
                "verify",
                "check",
                "confirm",
            ]
        ),
    }

    print("\n========== EVALUATION ==========\n")

    for check, result in checks.items():
        status = "PASS" if result else "FAIL"
        print(f"{status} - {check}")

    print("\n================================\n")


print("Referral Copilot Test Harness")
print("Type 'exit' to quit.\n")

while True:
    query = input("User > ")

    if query.lower() in ["exit", "quit"]:
        break

    try:
        response = client.responses.create(
            model="gpt-5",
            instructions=skill,
            input=query,
        )

        answer = response.output_text

        print("\nAgent >")
        print(answer)

        evaluate_response(query, answer)

    except Exception as e:
        print(f"\nError: {e}\n")