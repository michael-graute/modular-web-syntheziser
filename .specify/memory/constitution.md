# Project Constitution

## Code Quality Principles

### Readability and Maintainability
- Code must be self-documenting with clear variable and function names
- Complex logic requires explanatory comments focusing on "why" not "what"
- Functions should follow the Single Responsibility Principle
- Maximum function length: 50 lines (exceptions require justification)
- Avoid deep nesting (max 3 levels); refactor into separate functions when exceeded

### Code Organization
- Follow consistent file and folder naming conventions
- Group related functionality into cohesive modules
- Maintain clear separation of concerns (business logic, data access, presentation)
- Keep dependencies explicit and minimized
- Prefer composition over inheritance

### Code Standards
- All code must pass linting without warnings
- Follow language-specific style guides and idioms
- Use TypeScript/static typing where available to catch errors at compile time
- Avoid magic numbers and strings; use named constants
- Remove commented-out code and debug statements before committing

## Testing Standards

### Test Coverage Requirements
- Minimum 80% code coverage for critical business logic
- 100% coverage for utility functions and shared libraries
- All public APIs must have comprehensive test suites
- Bug fixes must include regression tests

### Test Quality
- Tests must be isolated and independent (no shared state)
- Use descriptive test names that explain the scenario and expected outcome
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies appropriately
- Avoid testing implementation details; focus on behavior

### Testing Practices
- Run tests locally before committing
- Tests must be fast (unit tests < 100ms, integration tests < 5s)
- Flaky tests must be fixed immediately or removed
- Maintain separate test suites for unit, integration, and e2e tests
- Use test fixtures and factories for consistent test data

## User Experience Consistency

### Interface Design
- Maintain consistent UI patterns across all features
- Follow established design system and component library
- Ensure responsive design works on all target screen sizes
- Maintain consistent spacing, typography, and color usage
- All interactive elements must have clear hover/focus/active states

### User Feedback
- Provide immediate feedback for all user actions
- Display clear error messages with actionable guidance
- Show loading states for operations taking > 300ms
- Implement optimistic updates where appropriate
- Validate user input with helpful inline error messages

### Accessibility
- All UI components must be keyboard navigable
- Maintain WCAG 2.1 Level AA compliance minimum
- Provide appropriate ARIA labels and roles
- Ensure sufficient color contrast (4.5:1 for normal text)
- Support screen readers and assistive technologies

### Language and Content
- Use clear, concise, and consistent terminology
- Write in active voice with user-focused language
- Maintain consistent tone across all user-facing text
- Avoid technical jargon in user interfaces
- Provide helpful tooltips and contextual help

## Performance Requirements

### Load Time Standards
- Initial page load: < 3 seconds on 3G connection
- Time to Interactive (TTI): < 5 seconds
- First Contentful Paint (FCP): < 1.5 seconds
- Largest Contentful Paint (LCP): < 2.5 seconds

### Runtime Performance
- Maintain 60 FPS for animations and interactions
- API response times: < 200ms for critical paths, < 1s for others
- Database queries: < 100ms for simple queries, < 500ms for complex
- Memory leaks must be identified and fixed immediately
- Implement pagination for lists exceeding 100 items

### Optimization Requirements
- Images must be optimized and lazy-loaded
- Implement code splitting for bundles > 200KB
- Use caching strategies appropriately (client and server)
- Minimize network requests; bundle when beneficial
- Compress all text-based assets (gzip/brotli)

### Monitoring
- Track Core Web Vitals in production
- Set up alerts for performance regressions
- Monitor error rates and API latency
- Conduct performance audits before major releases
- Maintain performance budget and track bundle sizes

## Code Review Standards

### Review Requirements
- All code changes require at least one approval
- Authors must test their changes before requesting review
- Reviewers must run the code locally for significant changes
- Address all review comments or provide clear rationale

### Review Focus Areas
- Correctness and logic errors
- Test coverage and quality
- Performance implications
- Security vulnerabilities
- Adherence to these constitutional principles

## Continuous Improvement

- These principles are living documents and should evolve
- Propose changes through team discussion and consensus
- Regularly review and update based on lessons learned
- Celebrate wins and learn from mistakes
- Invest in tooling and automation to enforce standards
