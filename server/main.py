from fastapi import FastAPI

from app.routes import router


def create_app() -> FastAPI:
    app = FastAPI(title="MindJournal Summarizer", version="0.1.0")
    app.include_router(router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=80, reload=True)


if __name__ == "__main__":
    main()
