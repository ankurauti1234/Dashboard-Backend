const { MongoClient } = require("mongodb");

class EventBufferService {
  constructor() {
    this.buffer = [];
    this.bufferSize = 10; // Adjust based on your needs
    this.flushInterval = 1000; // 1 second
    this.client = null;
    this.db = null;
    this.collection = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async initialize() {
    try {
      this.client = await MongoClient.connect(process.env.MONGODB_URI);
      this.db = this.client.db();
      this.collection = this.db.collection("events");
      console.log("Connected to MongoDB");

      // Start the flush interval
      setInterval(() => this.flush(), this.flushInterval);
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  }

  async addEvent(eventData) {
    this.buffer.push(eventData);
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const batchToInsert = [...this.buffer];
    this.buffer = [];

    await this.insertWithRetry(batchToInsert);
  }

  async insertWithRetry(batch, attempt = 0) {
    try {
      await this.collection.insertMany(batch, { ordered: false });
      console.log(`Inserted ${batch.length} events`);
    } catch (error) {
      console.error("Error inserting batch:", error);
      if (attempt < this.retryAttempts) {
        console.log(`Retrying insert... Attempt ${attempt + 1}`);
        setTimeout(
          () => this.insertWithRetry(batch, attempt + 1),
          this.retryDelay
        );
      } else {
        console.error("Max retry attempts reached. Some data may be lost.");
        // Here you might want to implement a fallback strategy,
        // such as saving to a file or sending to an error queue
      }
    }
  }

  async close() {
    if (this.client) {
      await this.flush(); // Ensure any remaining data is flushed
      await this.client.close();
      console.log("Disconnected from MongoDB");
    }
  }
}

const eventBufferService = new EventBufferService();
module.exports = { eventBufferService };
