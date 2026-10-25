using FluentAssertions;
using Pitbull.Core.Jobs;

namespace Pitbull.Tests.Unit.Jobs;

public class JobContextTests
{
    [Fact]
    public void JobContext_DefaultValues_AreSet()
    {
        var context = new JobContext
        {
            TenantId = Guid.NewGuid(),
            CompanyId = Guid.NewGuid(),
            UserId = "test-user"
        };

        context.TenantId.Should().NotBeEmpty();
        context.CompanyId.Should().NotBeEmpty();
        context.UserId.Should().Be("test-user");
        context.CorrelationId.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void JobContext_CorrelationId_IsUniquePerInstance()
    {
        var ctx1 = new JobContext { TenantId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), UserId = "u1" };
        var ctx2 = new JobContext { TenantId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), UserId = "u2" };

        ctx1.CorrelationId.Should().NotBe(ctx2.CorrelationId);
    }
}
