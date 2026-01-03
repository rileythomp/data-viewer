package config

import "os"

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServerPort string
}

func Load() *Config {
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5500"),
		DBUser:     getEnv("DB_USER", "metabase"),
		DBPassword: getEnv("DB_PASSWORD", "mysecretpassword"),
		DBName:     getEnv("DB_NAME", "finances"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
