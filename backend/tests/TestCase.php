<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Log in via the API and return the JWT token for the given user.
     * The user must have the given password (e.g. created with Hash::make('password')).
     */
    protected function getTokenFor(User $user, string $password = 'password'): string
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => $password,
        ]);

        $response->assertStatus(200);
        $token = $response->json('token');
        $this->assertNotEmpty($token);

        return $token;
    }

    /** Return Authorization header array for use with $this->withHeaders(). */
    protected function authHeaders(string $token): array
    {
        return ['Authorization' => 'Bearer ' . $token];
    }
}
