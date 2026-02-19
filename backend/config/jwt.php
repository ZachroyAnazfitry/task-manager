<?php

return [
    'secret' => env('JWT_SECRET', 'changeme'),
    'ttl' => (int) env('JWT_TTL', 60),
    'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 20160),
    'algo' => 'HS256',
    'user' => \App\Models\User::class,
    'identifier' => 'id',
    'required_claims' => ['iss', 'iat', 'exp', 'nbf', 'sub', 'jti'],
    'blacklist_enabled' => env('JWT_BLACKLIST_ENABLED', true),
    'providers' => [
        'jwt' => \Tymon\JWTAuth\Providers\JWT\Lcobucci::class,
        'auth' => \Tymon\JWTAuth\Providers\Auth\Illuminate::class,
        'storage' => \Tymon\JWTAuth\Providers\Storage\Illuminate::class,
    ],
];
